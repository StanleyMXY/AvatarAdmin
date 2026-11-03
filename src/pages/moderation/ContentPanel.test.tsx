import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationState, RECORD_ID } from '../../../mock/_core/moderationData';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import type { ModerationRecord } from '../../services/moderation';
import { ContentPanel } from './ContentPanel';
import { interceptFetch, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => vi.unstubAllGlobals());

const recordOf = (id: string): ModerationRecord => {
  const record = moderationState.records.find((r) => r.id === id);
  if (!record) throw new Error(`no record ${id}`);
  return record as unknown as ModerationRecord;
};

const image = (sig: string) =>
  jsonResponse(
    200,
    envelope('200', { kind: 'FILE', mediaType: 'image/png', url: `/m?sig=${sig}` }),
  );

// A panel whose permission can be switched off and on, which is how its request is replaced while
// an earlier one is still on its way.
function Switchable({ record }: { record: ModerationRecord }) {
  const [canReview, setCanReview] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setCanReview((on) => !on)}>
        switch
      </button>
      <ContentPanel record={record} canReview={canReview} />
    </>
  );
}

describe('the content area, requests and the image', { timeout: 30000 }, () => {
  it('asks the browser not to send the address of this page as the referrer of the image', async () => {
    installMockBackend(moderationMock);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    const picture = await screen.findByRole('img');
    expect(picture).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('does not let an answer that was overtaken replace the newer one', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let asked = 0;
    installMockBackend(moderationMock);
    interceptFetch(async (url) => {
      if (!url.endsWith('/content')) return undefined;
      asked += 1;
      if (asked === 1) {
        await gate;
        return image('OLD');
      }
      return image('NEW');
    });
    renderPage(<Switchable record={recordOf(RECORD_ID.reportedAvatar)} />);
    await waitFor(() => expect(asked).toBe(1));
    await user.click(screen.getByRole('button', { name: 'switch' }));
    await user.click(screen.getByRole('button', { name: 'switch' }));
    const picture = await screen.findByRole('img');
    await waitFor(() => expect(picture.getAttribute('src')).toBe('/m?sig=NEW'));
    release();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByRole('img').getAttribute('src')).toBe('/m?sig=NEW');
  });
});

// The address of a file stops working at `expiresAt` (backend answer 134). The panel asks again a
// little before, once per address, so the player never meets an expired address; every read writes
// an audit row, so it does not ask without a reason.
describe('the address of a file is renewed before it expires', { timeout: 30000 }, () => {
  const MINUTE = 60_000;

  const file = (sig: string, expiresInMs: number | null, mediaType = 'image/png') =>
    jsonResponse(
      200,
      envelope('200', {
        kind: 'FILE',
        mediaType,
        url: `/m?sig=${sig}`,
        ...(expiresInMs === null
          ? {}
          : { expiresAt: new Date(Date.now() + expiresInMs).toISOString() }),
      }),
    );

  /** Answers the content reads in turn from `answers` (the last one repeats) and counts them. */
  const scripted = (answers: (() => Response)[]) => {
    const state = { asked: 0 };
    installMockBackend(moderationMock);
    interceptFetch((url) => {
      if (!url.endsWith('/content')) return undefined;
      const answer = answers[Math.min(state.asked, answers.length - 1)];
      state.asked += 1;
      return answer();
    });
    return state;
  };
  const picture = () => screen.getByRole('img');
  const startedAt = Date.now();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(startedAt);
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  /** Moves the clock in steps, so that the page can plan its next read between them. */
  const advanceBySteps = async (ms: number, step = 1_000) => {
    for (let spent = 0; spent < ms; spent += step) await advance(step);
  };

  it('asks again once the address is close to its end and not before, and shows the new address', async () => {
    const state = scripted([() => file('A', 5 * MINUTE), () => file('B', 5 * MINUTE)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=A'), { timeout: 8000 });
    expect(state.asked).toBe(1);
    // four minutes in: the address has a minute left, more than the margin of 30 seconds
    await advance(4 * MINUTE);
    expect(state.asked).toBe(1);
    expect(picture().getAttribute('src')).toBe('/m?sig=A');
    // 30 seconds before the end: the one new read
    await advance(MINUTE - 29_000);
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
    expect(state.asked).toBe(2);
  });

  it('asks once for each address: the next read is planned from the new expiry, not from the old', async () => {
    const state = scripted([
      () => file('A', 5 * MINUTE),
      () => file('B', 5 * MINUTE),
      () => file('C', 5 * MINUTE),
    ]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    // the address is on the screen, so the time of its end is known
    await screen.findByRole('img');
    await advance(5 * MINUTE - 30_000);
    await waitFor(() => expect(state.asked).toBe(2), { timeout: 8000 });
    // a long while on the new address that is still good: no read
    await advance(2 * MINUTE);
    expect(state.asked).toBe(2);
    await advance(2 * MINUTE + 31_000);
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=C'), { timeout: 8000 });
    expect(state.asked).toBe(3);
  });

  it('does not ask again for a text, which has no expiry, however long the page stays open', async () => {
    const state = scripted([
      () => jsonResponse(200, envelope('200', { kind: 'TEXT', text: 'Hola, ¿qué tal?' })),
    ]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedMessage)} canReview />);
    await screen.findByTestId('moderation-content-text');
    await advance(3 * 60 * MINUTE);
    expect(state.asked).toBe(1);
  });

  it('does not plan a read for an answer without expiresAt, one whose time is not a time, or one that is over already', async () => {
    for (const answer of [
      () => file('A', null),
      () =>
        jsonResponse(
          200,
          envelope('200', {
            kind: 'FILE',
            mediaType: 'image/png',
            url: '/m?sig=A',
            expiresAt: 'tomorrow, maybe',
          }),
        ),
      () => file('A', -MINUTE),
    ]) {
      const state = scripted([answer]);
      const view = renderPage(
        <ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />,
      );
      await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
      // the address is on the screen, so the time of its end is known
      await screen.findByRole('img');
      await screen.findByRole('img');
      await advance(30 * MINUTE);
      expect(state.asked).toBe(1);
      view.unmount();
    }
  });

  it('does not ask when the tab is hidden, and asks when it is shown again (a read is an audit row nobody looked at)', async () => {
    const state = scripted([() => file('A', 5 * MINUTE), () => file('B', 5 * MINUTE)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    // the address is on the screen, so the time of its end is known
    await screen.findByRole('img');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await advance(10 * MINUTE);
    expect(state.asked).toBe(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
    expect(state.asked).toBe(2);
  });

  it('keeps the player as it is while a sound is playing, and renews the address when it stops', async () => {
    const state = scripted([
      () => file('A', 5 * MINUTE, 'audio/mpeg'),
      () => file('B', 5 * MINUTE, 'audio/mpeg'),
    ]);
    const { container } = renderPage(
      <ContentPanel record={recordOf(RECORD_ID.reportedVoice)} canReview />,
    );
    await waitFor(() => expect(container.querySelector('audio')).not.toBeNull(), { timeout: 8000 });
    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    await advance(10 * MINUTE);
    expect(state.asked).toBe(1);
    expect(audio.getAttribute('src')).toBe('/m?sig=A');
    Object.defineProperty(audio, 'paused', { configurable: true, value: true });
    await advance(6_000);
    await waitFor(() => expect(state.asked).toBe(2), { timeout: 8000 });
    await waitFor(() =>
      expect(container.querySelector('audio')?.getAttribute('src')).toBe('/m?sig=B'),
    );
  });

  it('keeps what is shown when the renewal fails, and says nothing: the player has the last word', async () => {
    const state = scripted([
      () => file('A', 5 * MINUTE),
      () => jsonResponse(500, envelope('INTERNAL_ERROR', null, 'boom')),
    ]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    // the address is on the screen, so the time of its end is known
    await screen.findByRole('img');
    await advance(5 * MINUTE - 20_000);
    await waitFor(() => expect(state.asked).toBe(2), { timeout: 8000 });
    expect(picture().getAttribute('src')).toBe('/m?sig=A');
    expect(screen.queryByRole('alert')).toBeNull();
    // and a read that is not planned again by itself: no loop of reads against a backend that fails
    await advance(30 * MINUTE);
    expect(state.asked).toBe(2);
  });

  it('shows that the original is gone when the renewal finds it is not stored any more', async () => {
    const state = scripted([
      () => file('A', 5 * MINUTE),
      () => jsonResponse(404, envelope('CONTENT_NOT_STORED', null, 'gone')),
    ]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    // the address is on the screen, so the time of its end is known
    await screen.findByRole('img');
    await advance(5 * MINUTE - 20_000);
    await waitFor(() => expect(state.asked).toBe(2), { timeout: 8000 });
    expect(await screen.findByText(/no longer stored|not stored/i)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('plans nothing after the panel is left, and none for the record that was left', async () => {
    const state = scripted([() => file('A', 5 * MINUTE)]);
    const view = renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    // the address is on the screen, so the time of its end is known
    await screen.findByRole('img');
    view.unmount();
    await advance(30 * MINUTE);
    expect(state.asked).toBe(1);
  });

  it('plans nothing without MODERATION:REVIEW', async () => {
    const state = scripted([() => file('A', 5 * MINUTE)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview={false} />);
    await advance(30 * MINUTE);
    expect(state.asked).toBe(0);
  });

  it('still renews once through the player when an address fails before its time (a clock that is off)', async () => {
    const state = scripted([() => file('A', null), () => file('B', null)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    const first = await screen.findByRole('img');
    await act(async () => {
      first.dispatchEvent(new Event('error'));
    });
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
    expect(state.asked).toBe(2);
  });

  // A browser clock that runs ahead of the server's makes every answer look nearly over. Each read
  // writes an audit row, so the panel must not turn that into a read every few seconds.
  it('does not read again and again when every answer looks nearly over (a clock that runs ahead)', async () => {
    const state = scripted([() => file('A', 8_000)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    await screen.findByRole('img');
    await advanceBySteps(10 * MINUTE);
    // the first read, and one renewal; the renewed address is still short, so the player's own failure is the way on
    expect(state.asked).toBeLessThanOrEqual(2);
  });

  it('after the short renewed address, still renews once when the player fails', async () => {
    const state = scripted([
      () => file('A', 8_000),
      () => file('B', 8_000),
      () => file('C', 8_000),
    ]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    await screen.findByRole('img');
    await advanceBySteps(10_000);
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
    await advanceBySteps(5 * MINUTE);
    expect(state.asked).toBe(2);
    await act(async () => {
      picture().dispatchEvent(new Event('error'));
    });
    await waitFor(() => expect(picture().getAttribute('src')).toBe('/m?sig=C'), { timeout: 8000 });
    expect(state.asked).toBe(3);
  });

  it('renews by itself at most 3 times for one record, however long the page stays, then only when the player fails', async () => {
    const state = scripted([() => file('A', 2 * MINUTE)]);
    renderPage(<ContentPanel record={recordOf(RECORD_ID.reportedAvatar)} canReview />);
    await waitFor(() => expect(state.asked).toBe(1), { timeout: 8000 });
    await screen.findByRole('img');
    await advanceBySteps(60 * MINUTE, 10_000);
    // the first read and 3 renewals
    expect(state.asked).toBe(4);
    await act(async () => {
      picture().dispatchEvent(new Event('error'));
    });
    await waitFor(() => expect(state.asked).toBe(5), { timeout: 8000 });
    await advanceBySteps(60 * MINUTE, 10_000);
    expect(state.asked).toBe(5);
  });

  describe('a clip that was stopped in the middle keeps its place when the address is replaced', () => {
    /** A media element that remembers what was written to `currentTime` (happy-dom has no player). */
    const fake = (element: HTMLMediaElement, position: number, paused: boolean) => {
      const writes: number[] = [];
      let current = position;
      Object.defineProperty(element, 'currentTime', {
        configurable: true,
        get: () => current,
        set: (value: number) => {
          writes.push(value);
          current = value;
        },
      });
      Object.defineProperty(element, 'paused', { configurable: true, value: paused });
      return writes;
    };

    it('puts the position back once the new address has its metadata, and does not start it', async () => {
      const state = scripted([
        () => file('A', 5 * MINUTE, 'video/mp4'),
        () => file('B', 5 * MINUTE, 'video/mp4'),
      ]);
      const { container } = renderPage(
        <ContentPanel record={recordOf(RECORD_ID.reportedVoice)} canReview />,
      );
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull(), {
        timeout: 8000,
      });
      const video = container.querySelector('video') as HTMLVideoElement;
      const play = vi.fn();
      video.play = play as unknown as HTMLVideoElement['play'];
      const writes = fake(video, 80, true);
      await advance(5 * MINUTE - 20_000);
      await waitFor(() => expect(video.getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
      expect(state.asked).toBe(2);
      // the new address is not ready: a position written now would be lost
      expect(writes).toEqual([]);
      await act(async () => {
        video.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(writes).toEqual([80]);
      expect(play).not.toHaveBeenCalled();
      // and only once: a later load of metadata (a seek, another reload) is not set back to 80
      await act(async () => {
        video.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(writes).toEqual([80]);
    });

    it('writes nothing for a clip that was never played', async () => {
      scripted([
        () => file('A', 5 * MINUTE, 'audio/mpeg'),
        () => file('B', 5 * MINUTE, 'audio/mpeg'),
      ]);
      const { container } = renderPage(
        <ContentPanel record={recordOf(RECORD_ID.reportedVoice)} canReview />,
      );
      await waitFor(() => expect(container.querySelector('audio')).not.toBeNull(), {
        timeout: 8000,
      });
      const audio = container.querySelector('audio') as HTMLAudioElement;
      const writes = fake(audio, 0, true);
      await advance(5 * MINUTE - 20_000);
      await waitFor(() => expect(audio.getAttribute('src')).toBe('/m?sig=B'), { timeout: 8000 });
      await act(async () => {
        audio.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(writes).toEqual([]);
    });
  });
});
