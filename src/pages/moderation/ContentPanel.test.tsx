import { screen, waitFor } from '@testing-library/react';
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
