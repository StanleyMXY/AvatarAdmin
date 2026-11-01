import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';
import { LandBar } from './LandBar';

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T17:30:00Z'));
  as(['STATS:LAND']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LandBar', () => {
  it('is not drawn without STATS:LAND', () => {
    as(['STATS:VIEW']);
    renderPage(<LandBar name="daily-event" onLanded={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is drawn for a super administrator', () => {
    as([], true);
    renderPage(<LandBar name="daily-event" onLanded={() => {}} />);
    expect(screen.getByRole('button', { name: 'Re-land this day' })).toBeInTheDocument();
  });

  it('starts on the UTC yesterday, which is the 20th in Singapore at 01:30 on the 22nd', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      renderPage(<LandBar name="daily-event" onLanded={() => {}} />);
      const input = document.querySelector('.ant-picker-input input') as HTMLInputElement;
      expect(input.value).toBe('2026-10-20');
    });
  });

  it('can name the day and add a hint in its own words, for a summary whose days are not UTC days', () => {
    renderPage(
      <LandBar
        name="daily-event"
        onLanded={() => {}}
        dateLabelId="activity.stats.land.date"
        hintId="activity.stats.land.hint"
      />,
    );
    expect(screen.getByText('Date (local day of the users)')).toBeInTheDocument();
    expect(screen.getByText('Recomputes the summary of the chosen local day.')).toBeInTheDocument();
    expect(screen.queryByText('Date (UTC)')).toBeNull();
  });

  it('says UTC and no hint when it is given no words of its own', () => {
    renderPage(<LandBar name="daily-event" onLanded={() => {}} />);
    expect(screen.getByText('Date (UTC)')).toBeInTheDocument();
    expect(screen.queryByText('Recomputes the summary of the chosen local day.')).toBeNull();
  });

  it('posts the name and the day, then tells the page', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const onLanded = vi.fn();
    renderPage(<LandBar name="session-quality" onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(onLanded).toHaveBeenCalledTimes(1));
    expect(calls[0].url).toBe('/api/admin/stats/land/session-quality?date=2026-10-20');
    expect(calls[0].init.method).toBe('POST');
    expect(await screen.findByText('Re-landed 2026-10-20')).toBeInTheDocument();
  });

  it('runs several names one after the other and stops at the first failure', async () => {
    const calls = stubFetch((call) =>
      call.url.includes('daily-event')
        ? jsonResponse(500, envelope('INTERNAL_ERROR'))
        : jsonResponse(200, envelope('200', null)),
    );
    const onLanded = vi.fn();
    renderPage(<LandBar name={['daily-event', 'daily-business']} onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toHaveLength(1);
    expect(onLanded).not.toHaveBeenCalled(); // nothing was re-landed
  });

  it('tells the page when the first name was re-landed and the second failed', async () => {
    const calls = stubFetch((call) =>
      call.url.includes('daily-business')
        ? jsonResponse(500, envelope('INTERNAL_ERROR'))
        : jsonResponse(200, envelope('200', null)),
    );
    const onLanded = vi.fn();
    renderPage(<LandBar name={['daily-event', 'daily-business']} onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() => expect(onLanded).toHaveBeenCalledTimes(1));
  });

  it('runs both names in order when all succeed', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const onLanded = vi.fn();
    renderPage(<LandBar name={['daily-event', 'daily-business']} onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(onLanded).toHaveBeenCalledTimes(1));
    expect(calls.map((c) => c.url.split('?')[0])).toEqual([
      '/api/admin/stats/land/daily-event',
      '/api/admin/stats/land/daily-business',
    ]);
  });

  it('shows the backend text when it fails, and does not tell the page', async () => {
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    const onLanded = vi.fn();
    renderPage(<LandBar name="push" onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(onLanded).not.toHaveBeenCalled();
  });

  it('sends once however often the button is pressed', async () => {
    let release: (r: Response) => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    renderPage(<LandBar name="push" onLanded={() => {}} />);
    const button = screen.getByRole('button', { name: /Re-land this day/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(calls).toHaveLength(1);
    release(jsonResponse(200, envelope('200', null)));
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
