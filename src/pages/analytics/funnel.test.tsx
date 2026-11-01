import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsStore, FUNNEL_RATE_LIMIT_STEP } from '../../../mock/_core/analyticsData';
import * as analyticsMock from '../../../mock/analytics.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import FunnelPage from './funnel';
import { MANAGE, signIn, VIEW } from './testSetup';

beforeEach(() => signIn('support', { codes: MANAGE }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type Calls = ReturnType<typeof useMockBackend>;
const funnelCalls = (calls: { url: string }[]) =>
  calls.filter((c) => new URL(c.url, 'http://x').pathname.endsWith('/analytics/funnel'));
const writes = (calls: Calls, method: string) => calls.filter((c) => c.method === method);
const lastFunnel = (calls: Calls) => new URL(funnelCalls(calls).at(-1)?.url as string, 'http://x');
const button = (name: string | RegExp) => screen.queryByRole('button', { name });
const queryButton = () => screen.getByRole('button', { name: 'Query' });
/** Anything on the page that still shows a loading state (the table's own spin container is not one). */
const busyMarks = () => document.querySelector('.ant-spin-spinning, [aria-busy="true"]');

const openPage = async (user = userEvent.setup()) => {
  const calls = useMockBackend(analyticsMock);
  renderPage(<FunnelPage />);
  await waitFor(() => expect(calls.some((c) => c.url.endsWith('/analytics/funnels'))).toBe(true));
  return { calls, user };
};
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('combobox', { name: 'Saved funnel' }));
  const options = await screen.findAllByText(name, {
    selector: '.ant-select-item-option-content *, .ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
};
const stepTags = () =>
  Array.from(
    document.querySelectorAll('[data-testid="funnel-steps"] .ant-select-selection-item-content'),
  ).map((e) => e.textContent);
const addStep = async (_user: ReturnType<typeof userEvent.setup>, name: string) => {
  const box = screen.getByRole('combobox', { name: 'Steps' });
  fireEvent.change(box, { target: { value: name } });
  fireEvent.keyDown(box, { key: 'Enter', keyCode: 13 });
  await waitFor(() => expect(stepTags()).toContain(name));
  // The list stays open after a step is added, and in this DOM a second typed step is then not taken:
  // closing it (as a person does by clicking away) lets the next one be typed.
  fireEvent.keyDown(box, { key: 'Escape', keyCode: 27 });
  fireEvent.blur(box);
};
let nextId = 900;
/** A custom funnel in the mock backend's list, as if somebody had saved it. */
const seed = (name: string, steps: string[], windowHours = 24) => {
  analyticsStore.funnels.push({
    id: String(nextId++),
    name,
    steps,
    windowHours,
    isPreset: false,
    createdBy: '1001',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  });
  return name;
};
const funnelRow = (name: string, steps: string[], windowHours = 24) => ({
  id: name,
  name,
  steps,
  windowHours,
  isPreset: false,
  createdBy: '1001',
  createdByUsername: 'root',
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
});
/** Answers the page with fixed saved funnels and a funnel answer made by `funnel` (or `refuse`). */
const stubBackend = (options: {
  funnels: ReturnType<typeof funnelRow>[];
  funnel: (steps: string[]) => unknown[] | Promise<unknown[]>;
  refuse?: Response;
}) =>
  stubFetch(async ({ url }) => {
    const parsed = new URL(url, 'http://x');
    if (parsed.pathname.endsWith('/analytics/funnels'))
      return jsonResponse(200, envelope('200', { items: options.funnels }));
    if (parsed.pathname.endsWith('/event-names'))
      return jsonResponse(200, envelope('200', { items: [] }));
    if (options.refuse) return options.refuse.clone();
    const steps = (parsed.searchParams.get('steps') as string).split(',');
    return jsonResponse(200, envelope('200', { steps: await options.funnel(steps) }));
  });
const idOf = (name: string) => analyticsStore.funnels.find((f) => f.name === name)?.id as string;
const windowBox = () => screen.getByLabelText('Window (hours)') as HTMLInputElement;
const presetName = (index: number) => analyticsStore.funnels.filter((f) => f.isPreset)[index].name;

describe('the funnel page: saved funnels', { timeout: 40000 }, () => {
  it('lists the saved funnels, the presets with the tag "System preset" and the custom ones without', async () => {
    seed('ก็'.repeat(200), ['a', 'b'], 6);
    const { user } = await openPage();
    await user.click(screen.getByRole('combobox', { name: 'Saved funnel' }));
    await screen.findAllByText('System preset');
    const options = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
    const presets = analyticsStore.funnels.filter((f) => f.isPreset);
    expect(presets).toHaveLength(3);
    expect(options).toHaveLength(analyticsStore.funnels.length);
    for (const option of options) {
      const isPreset = presets.some((p) => option.textContent?.includes(p.name));
      expect(within(option).queryByText('System preset') !== null, option.textContent ?? '').toBe(
        isPreset,
      );
    }
  });

  it('fills the steps and the window from the chosen funnel and asks at once, with the steps, the window and the days now in the form', async () => {
    const { user, calls } = await openPage();
    const second = analyticsStore.funnels.filter((f) => f.isPreset)[1];
    await choose(user, second.name);
    await waitFor(() => expect(stepTags()).toEqual(second.steps));
    expect(windowBox().value).toBe(String(second.windowHours));
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    const url = lastFunnel(calls);
    expect(url.searchParams.get('steps')).toBe(second.steps.join(','));
    expect(url.searchParams.get('windowHours')).toBe(String(second.windowHours));
    expect(url.searchParams.get('to')).toBe(new Date().toISOString().slice(0, 10));
    expect(await screen.findByTestId('funnel-result')).toBeInTheDocument();
  });

  it('asks at once for a custom funnel too, and for an administrator who can only view', async () => {
    signIn('support', { codes: VIEW });
    seed('Mine', ['a', 'b', 'c'], 12);
    const { user, calls } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    expect(lastFunnel(calls).searchParams.get('steps')).toBe('a,b,c');
    expect(lastFunnel(calls).searchParams.get('windowHours')).toBe('12');
  });

  it('asks again for each funnel chosen, but not when the choice is cleared and not when a step or the window is edited', async () => {
    seed('First', ['a', 'b'], 6);
    seed('Second', ['c', 'd'], 8);
    const { user, calls } = await openPage();
    await choose(user, 'First');
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    await choose(user, 'Second');
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(2));
    expect(lastFunnel(calls).searchParams.get('steps')).toBe('c,d');
    await addStep(user, 'e');
    fireEvent.change(windowBox(), { target: { value: '9' } });
    await user.click(
      document.querySelector('#analytics-funnel-saved')?.closest('.ant-select') as HTMLElement,
    );
    const clear = document.querySelector('.ant-select-clear') as HTMLElement;
    fireEvent.mouseDown(clear);
    await new Promise((r) => setTimeout(r, 150));
    expect(funnelCalls(calls)).toHaveLength(2);
  });

  it('does not ask for a saved funnel that could not be asked (a step with a comma), and says why', async () => {
    const calls = stubBackend({
      funnels: [funnelRow('Broken', ['a,b', 'c'])],
      funnel: () => [],
    });
    const user = userEvent.setup();
    renderPage(<FunnelPage />);
    await choose(user, 'Broken');
    expect(await screen.findByText(/comma/i)).toBeInTheDocument();
    expect(queryButton()).toBeDisabled();
    await new Promise((r) => setTimeout(r, 150));
    expect(funnelCalls(calls)).toHaveLength(0);
  });

  it('does not ask again when a funnel is saved: that is not choosing one', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Brand new');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls, 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 200));
    expect(funnelCalls(calls)).toHaveLength(1);
  });

  it('gives a preset no Edit and no Delete, but Save as stays (to make a copy)', async () => {
    const { user } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(stepTags().length).toBe(2));
    expect(button('Edit')).toBeNull();
    expect(button('Delete')).toBeNull();
    expect(button(/Save as/)).toBeInTheDocument();
  });

  it('gives a custom funnel Edit and Delete when the administrator has ANALYTICS:FUNNEL_MANAGE', async () => {
    seed('Mine', ['a', 'b', 'c'], 12);
    const { user } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b', 'c']));
    expect(button('Edit')).toBeInTheDocument();
    expect(button('Delete')).toBeInTheDocument();
  });

  it('shows no Save as, Edit or Delete without ANALYTICS:FUNNEL_MANAGE, but still queries', async () => {
    signIn('support', { codes: VIEW });
    seed('Mine', ['a', 'b'], 12);
    const { user, calls } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    expect(button(/Save as/)).toBeNull();
    expect(button('Edit')).toBeNull();
    expect(button('Delete')).toBeNull();
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    await user.click(queryButton());
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(2));
  });

  it('saves the current steps and window under a new name with one POST, however often the button is pressed', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(stepTags().length).toBe(2));
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), '  Copy ✨  ');
    const ok = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writes(calls, 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls, 'POST')).toHaveLength(1);
    expect(writes(calls, 'POST')[0].body).toEqual({
      name: 'Copy ✨',
      steps: ['app_open', 'register_completed'],
      windowHours: 24,
    });
    // the list is read again and the new funnel can be chosen, without the preset tag
    await waitFor(() =>
      expect(analyticsStore.funnels.some((f) => f.name === 'Copy ✨')).toBe(true),
    );
    await choose(user, 'Copy ✨');
    expect(button('Edit')).toBeInTheDocument();
  });

  it('sends the name once while the first request is still on its way, however often OK is pressed', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const calls = stubFetch(async ({ url, init }) => {
      const path = new URL(url, 'http://x').pathname;
      if ((init.method ?? 'GET') === 'POST') {
        await new Promise<void>((r) => (release = r));
        return jsonResponse(200, envelope('200', funnelRow('Slow', ['a', 'b'])));
      }
      if (path.endsWith('/analytics/funnels'))
        return jsonResponse(200, envelope('200', { items: [funnelRow('Two', ['a', 'b'])] }));
      return jsonResponse(200, envelope('200', { items: [] }));
    });
    renderPage(<FunnelPage />);
    await choose(user, 'Two');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Slow');
    const ok = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(ok);
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    fireEvent.click(ok);
    fireEvent.keyDown(within(dialog).getByLabelText('Name'), { key: 'Enter', keyCode: 13 });
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    release?.();
  });

  it('asks for a name: empty and blank-only names are refused in the dialog, with no request', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(stepTags().length).toBe(2));
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), `${String.fromCodePoint(0x3000)}  `);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument();
    expect(writes(calls, 'POST')).toHaveLength(0);
  });

  it('keeps the dialog open and shows only the words of the code when the name already exists', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(stepTags().length).toBe(2));
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), presetName(1));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls, 'POST')).toHaveLength(1));
    const failure = await within(dialog).findByRole('alert');
    expect(failure.textContent).toContain(enUS['error.DUPLICATE_RESOURCE']);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('changes a custom funnel with PUT: the new name with the steps and window now in the form', async () => {
    seed('Mine', ['a', 'b'], 12);
    const mineId = idOf('Mine');
    const { user, calls } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await addStep(user, 'c');
    fireEvent.change(windowBox(), { target: { value: '36' } });
    await user.click(button('Edit') as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Mine');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Mine 2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls, 'PUT')).toHaveLength(1));
    expect(writes(calls, 'PUT')[0].url).toBe(`/api/admin/analytics/funnels/${mineId}`);
    expect(writes(calls, 'PUT')[0].body).toEqual({
      name: 'Mine 2',
      steps: ['a', 'b', 'c'],
      windowHours: 36,
    });
    await waitFor(() =>
      expect(analyticsStore.funnels.find((f) => f.id === mineId)?.name).toBe('Mine 2'),
    );
  });

  it('deletes a custom funnel after the inline question, with one DELETE, and clears the choice', async () => {
    seed('Mine', ['a', 'b'], 12);
    const mineId = idOf('Mine');
    const { user, calls } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await user.click(button('Delete') as HTMLElement);
    expect(writes(calls, 'DELETE')).toHaveLength(0);
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writes(calls, 'DELETE')).toHaveLength(1));
    expect(writes(calls, 'DELETE')[0].url).toBe(`/api/admin/analytics/funnels/${mineId}`);
    await waitFor(() => expect(analyticsStore.funnels.some((f) => f.id === mineId)).toBe(false));
    await waitFor(() => expect(button('Delete')).toBeNull());
  });

  it('reads the list again and says why when the funnel was deleted by someone else (404)', async () => {
    seed('Mine', ['a', 'b'], 12);
    const { user, calls } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    analyticsStore.funnels = analyticsStore.funnels.filter((f) => f.name !== 'Mine');
    await user.click(button('Delete') as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(enUS['error.RESOURCE_NOT_FOUND'])).toBeInTheDocument();
    const listReads = calls.filter(
      (c) => c.method === 'GET' && c.url.endsWith('/analytics/funnels'),
    );
    expect(listReads.length).toBeGreaterThanOrEqual(2);
  });

  it('does not send a write again when the token expired while it was on its way', async () => {
    seed('Mine', ['a', 'b'], 12);
    const user = userEvent.setup();
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') !== 'GET')
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      if (url.endsWith('/analytics/funnels'))
        return jsonResponse(200, envelope('200', { items: analyticsStore.funnels }));
      return jsonResponse(200, envelope('200', { items: [] }));
    });
    renderPage(<FunnelPage />);
    await choose(user, 'Mine');
    await user.click(button('Delete') as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
  });
});

describe('the funnel page: the query', { timeout: 40000 }, () => {
  it('asks with the steps joined by commas, the window, and the UTC days of the last 7 days', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(1));
    await waitFor(() => expect(stepTags().length).toBe(4));
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    const url = lastFunnel(calls);
    expect(url.searchParams.get('steps')).toBe(
      'register_completed,avatar_created,voice_cloned,session_started',
    );
    expect(url.searchParams.get('windowHours')).toBe('24');
    const today = new Date().toISOString().slice(0, 10);
    expect(url.searchParams.get('to')).toBe(today);
    expect(
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(6 * 86400000);
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('uses the UTC date in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z'));
      const { user, calls } = await openPage(userEvent.setup({ advanceTimers: () => {} }));
      await choose(user, presetName(0));
      await waitFor(() => expect(stepTags().length).toBe(2));
      await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
      expect(lastFunnel(calls).searchParams.get('to')).toBe('2026-10-26');
      expect(lastFunnel(calls).searchParams.get('from')).toBe('2026-10-20');
    });
  });

  it('shows each step with its count and the conversion the backend sent, not one the page worked out', async () => {
    const calls = stubBackend({
      funnels: [funnelRow('F', ['a', 'b', 'c', 'd'])],
      funnel: () => [
        { eventName: 'a', count: 1000, conversionFromPrevious: null },
        { eventName: 'b', count: 800, conversionFromPrevious: 0.25 },
        { eventName: 'c', count: 0, conversionFromPrevious: 0 },
        { eventName: 'd', count: 0, conversionFromPrevious: null },
      ],
    });
    const user = userEvent.setup();
    renderPage(<FunnelPage />);
    await choose(user, 'F');
    const table = await screen.findByTestId('funnel-result');
    const rows = Array.from(table.querySelectorAll('tbody tr.ant-table-row')).map((r) =>
      Array.from(r.querySelectorAll('td')).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['1', 'a', '1,000', '—'],
      ['2', 'b', '800', '25%'],
      ['3', 'c', '0', '0%'],
      ['4', 'd', '0', '—'],
    ]);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|null%/);
    expect(calls.filter((c) => c.url.includes('/analytics/funnel?'))).toHaveLength(1);
  });

  it('draws the funnel chart with the same steps, counts and rates as the table', async () => {
    const { user } = await openPage();
    await choose(user, presetName(0));
    await waitFor(() => expect(stepTags().length).toBe(2));
    await user.click(queryButton());
    const chart = await screen.findByTestId('chart-funnel');
    const data = JSON.parse(chart.textContent as string) as { stage: string; value: number }[];
    expect(data.map((d) => d.stage)).toEqual(['app_open', 'register_completed']);
    const table = screen.getByTestId('funnel-result');
    const counts = Array.from(table.querySelectorAll('tbody tr.ant-table-row')).map(
      (r) => r.querySelectorAll('td')[2].textContent,
    );
    expect(data.map((d) => d.value.toLocaleString('en-US'))).toEqual(counts);
  });

  it('shows only the words of the code when the query is refused, keeps the form, and offers a retry', async () => {
    stubBackend({
      funnels: [funnelRow('F', ['a', 'b'])],
      funnel: () => {
        throw new Error('refused');
      },
      refuse: jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [] }, 'range is longer than 31 days'),
      ),
    });
    const user = userEvent.setup();
    renderPage(<FunnelPage />);
    await choose(user, 'F');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(enUS['error.INVALID_REQUEST']);
    expect(alert.textContent).not.toContain('range is longer than 31 days');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(stepTags()).toEqual(['a', 'b']);
  });

  it('says to try again later when too many funnels are being computed (429, no data), with no countdown, and the next press asks again', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await screen.findByTestId('funnel-result');
    expect(funnelCalls(calls)).toHaveLength(1);
    analyticsStore.funnelInFlight = 2;
    await user.click(queryButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(enUS['error.RATE_LIMITED']);
    expect(alert.textContent).not.toMatch(/\d+\s*(s|sec|second|minute|min)\b/i);
    expect(screen.queryByTestId('funnel-result')).toBeNull();
    // the buttons stay usable and the form is kept
    expect(queryButton()).toBeEnabled();
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(stepTags()).toEqual(['app_open', 'register_completed']);
    expect(funnelCalls(calls)).toHaveLength(2);
    // nothing keeps spinning after the refusal
    expect(busyMarks()).toBeNull();
    // when the place is free again the same press works
    analyticsStore.funnelInFlight = 0;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('funnel-result');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(busyMarks()).toBeNull();
    expect(funnelCalls(calls)).toHaveLength(3);
  });

  it('gets the 429 of the fake backend with a step that is named for it, which is how it is looked at with dev:mock (the count of funnels in flight cannot be raised there)', async () => {
    const { user, calls } = await openPage();
    await choose(user, presetName(0));
    await screen.findByTestId('funnel-result');
    expect(analyticsStore.funnelInFlight).toBe(0);
    await addStep(user, FUNNEL_RATE_LIMIT_STEP);
    await user.click(queryButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(enUS['error.RATE_LIMITED']);
    expect(lastFunnel(calls).searchParams.get('steps')).toContain(FUNNEL_RATE_LIMIT_STEP);
    expect(queryButton()).toBeEnabled();
  });

  it('disables Query while a query runs (a second press would take another place of the backend), and enables it again after the answer and after a 429', async () => {
    let release: (() => void) | undefined;
    let refuse = false;
    let asked = 0;
    stubFetch(async ({ url }) => {
      const parsed = new URL(url, 'http://x');
      if (parsed.pathname.endsWith('/analytics/funnels'))
        return jsonResponse(200, envelope('200', { items: [funnelRow('F', ['a', 'b'])] }));
      if (parsed.pathname.endsWith('/event-names'))
        return jsonResponse(200, envelope('200', { items: [] }));
      asked += 1;
      await new Promise<void>((r) => (release = r));
      if (refuse) return jsonResponse(429, envelope('RATE_LIMITED', null, 'Too many funnels'));
      return jsonResponse(
        200,
        envelope('200', {
          steps: [
            { eventName: 'a', count: 5, conversionFromPrevious: null },
            { eventName: 'b', count: 4, conversionFromPrevious: 0.8 },
          ],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<FunnelPage />);
    await choose(user, 'F');
    await waitFor(() => expect(asked).toBe(1));
    // running: the button is off and a press (also by keyboard or script) sends nothing
    await waitFor(() => expect(queryButton()).toBeDisabled());
    fireEvent.click(queryButton());
    await user.click(queryButton());
    expect(asked).toBe(1);
    release?.();
    await screen.findByTestId('funnel-result');
    await waitFor(() => expect(queryButton()).toBeEnabled());
    // the next query is refused with 429: the button comes back
    refuse = true;
    await user.click(queryButton());
    await waitFor(() => expect(asked).toBe(2));
    expect(queryButton()).toBeDisabled();
    release?.();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(enUS['error.RATE_LIMITED']);
    await waitFor(() => expect(queryButton()).toBeEnabled());
    expect(busyMarks()).toBeNull();
  });

  it('says it in Chinese too, never the words of the backend', async () => {
    const user = userEvent.setup();
    useMockBackend(analyticsMock);
    renderPage(<FunnelPage />, 'zh-CN');
    await user.click(await screen.findByRole('combobox', { name: '已保存的漏斗' }));
    const options = await screen.findAllByText(presetName(0), {
      selector: '.ant-select-item-option-content *, .ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await screen.findByTestId('funnel-result');
    analyticsStore.funnelInFlight = 2;
    await user.click(screen.getByRole('button', { name: /查\s?询/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('请求过于频繁，请稍后再试');
    expect(alert.textContent).not.toMatch(/Too many funnels/);
  });

  it('shows the answer of the newest query, also when an older one arrives later', async () => {
    let release: (() => void) | undefined;
    stubBackend({
      funnels: [funnelRow('Short', ['a', 'b']), funnelRow('Long', ['a', 'b', 'c'])],
      funnel: async (steps) => {
        if (steps.join(',') === 'a,b') await new Promise<void>((r) => (release = r));
        return steps.map((n, i) => ({
          eventName: n,
          count: 5,
          conversionFromPrevious: i ? 1 : null,
        }));
      },
    });
    const user = userEvent.setup();
    renderPage(<FunnelPage />);
    await choose(user, 'Short');
    await choose(user, 'Long');
    await screen.findByText('c', { selector: 'td *, td' });
    release?.();
    await new Promise((r) => setTimeout(r, 100));
    const table = screen.getByTestId('funnel-result');
    expect(
      Array.from(table.querySelectorAll('tbody tr.ant-table-row')).map(
        (r) => r.querySelectorAll('td')[1].textContent,
      ),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('the funnel page: what may be asked', { timeout: 40000 }, () => {
  it('disables Query with fewer than 2 steps and says how many are needed, without any request', async () => {
    seed('One', ['a']);
    const { user, calls } = await openPage();
    expect(queryButton()).toBeDisabled();
    await choose(user, 'One');
    await waitFor(() => expect(stepTags()).toEqual(['a']));
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('A funnel needs 2 to 10 steps')).toBeInTheDocument();
    await addStep(user, 'b');
    await waitFor(() => expect(queryButton()).toBeEnabled());
    expect(funnelCalls(calls)).toHaveLength(0);
  });

  it('allows 10 steps and refuses an 11th', async () => {
    seed(
      'Ten',
      Array.from({ length: 10 }, (_, i) => `e${i}`),
    );
    const { user } = await openPage();
    await choose(user, 'Ten');
    await waitFor(() => expect(stepTags()).toHaveLength(10));
    expect(queryButton()).toBeEnabled();
    expect(screen.queryByText('A funnel needs 2 to 10 steps')).toBeNull();
    await addStep(user, 'e10');
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('A funnel needs 2 to 10 steps')).toBeInTheDocument();
  });

  it('refuses an event name with a comma, because the steps travel as one comma-joined value', async () => {
    seed('Two', ['a', 'b']);
    const { user, calls } = await openPage();
    await choose(user, 'Two');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await addStep(user, 'x,y');
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('An event name cannot contain a comma')).toBeInTheDocument();
    // only the ask made when the funnel was chosen: the broken form is not asked
    await new Promise((r) => setTimeout(r, 150));
    expect(funnelCalls(calls)).toHaveLength(1);
  });

  it('refuses a step that is only blanks', async () => {
    seed('Two', ['a', 'b']);
    const { user } = await openPage();
    await choose(user, 'Two');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await addStep(user, `${String.fromCodePoint(0x3000)}${String.fromCharCode(0xa0)}`);
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('A step cannot be empty')).toBeInTheDocument();
  });

  it('refuses a window outside 1 to 720 hours and starts at 24', async () => {
    seed('Two', ['a', 'b']);
    const { user } = await openPage();
    expect(windowBox().value).toBe('24');
    await choose(user, 'Two');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    for (const [value, ok] of [
      ['0', false],
      ['1', true],
      ['720', true],
      ['721', false],
      ['', false],
      ['1.5', false],
    ] as const) {
      fireEvent.change(windowBox(), { target: { value } });
      fireEvent.blur(windowBox());
      await waitFor(() => expect(queryButton().hasAttribute('disabled'), value).toBe(!ok));
    }
    expect(screen.getByText('The window is 1 to 720 hours')).toBeInTheDocument();
  });

  it('keeps Save as and Edit shut while the form could not be asked, so a broken funnel is not saved', async () => {
    seed('Mine', ['a', 'b'], 12);
    const { user } = await openPage();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    fireEvent.change(windowBox(), { target: { value: '0' } });
    fireEvent.blur(windowBox());
    await waitFor(() => expect(button(/Save as/)).toBeDisabled());
    expect(button('Edit')).toBeDisabled();
  });
});

describe('the funnel page: steps typed one after the other', { timeout: 40000 }, () => {
  it('takes the steps in the order they are typed and asks with exactly those', async () => {
    const { user, calls } = await openPage();
    for (const name of ['app_open', 'register_completed', 'avatar_created']) {
      await addStep(user, name);
    }
    expect(stepTags()).toEqual(['app_open', 'register_completed', 'avatar_created']);
    await user.click(queryButton());
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    expect(lastFunnel(calls).searchParams.get('steps')).toBe(
      'app_open,register_completed,avatar_created',
    );
  });

  it('allows ten typed steps and refuses the eleventh', async () => {
    const { user } = await openPage();
    for (let i = 0; i < 10; i++) await addStep(user, `e${i}`);
    expect(stepTags()).toHaveLength(10);
    expect(queryButton()).toBeEnabled();
    await addStep(user, 'e10');
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('A funnel needs 2 to 10 steps')).toBeInTheDocument();
  });

  it('refuses a typed step with a comma among steps typed before it, and asks nothing', async () => {
    const { user, calls } = await openPage();
    await addStep(user, 'a');
    await addStep(user, 'b');
    expect(queryButton()).toBeEnabled();
    await addStep(user, 'x,y');
    expect(queryButton()).toBeDisabled();
    expect(screen.getByText('An event name cannot contain a comma')).toBeInTheDocument();
    expect(funnelCalls(calls)).toHaveLength(0);
  });
});

describe('the funnel page: a result belongs to the form it was asked with', {
  timeout: 40000,
}, () => {
  const withResult = async () => {
    seed('Mine', ['a', 'b'], 12);
    const opened = await openPage();
    await choose(opened.user, 'Mine');
    await screen.findByTestId('funnel-result');
    return opened;
  };

  it('takes the result away when a step is added, and shows what to do', async () => {
    const { user } = await withResult();
    await addStep(user, 'c');
    await waitFor(() => expect(screen.queryByTestId('funnel-result')).toBeNull());
    expect(screen.getByText('Choose the steps and press Query')).toBeInTheDocument();
  });

  it('takes the result away when the window changes', async () => {
    await withResult();
    fireEvent.change(windowBox(), { target: { value: '48' } });
    fireEvent.blur(windowBox());
    await waitFor(() => expect(screen.queryByTestId('funnel-result')).toBeNull());
  });

  it('shows a result again after Query, for the form as it is now', async () => {
    const { user, calls } = await withResult();
    await addStep(user, 'c');
    await waitFor(() => expect(screen.queryByTestId('funnel-result')).toBeNull());
    await user.click(queryButton());
    await screen.findByTestId('funnel-result');
    expect(lastFunnel(calls).searchParams.get('steps')).toBe('a,b,c');
  });

  it('keeps the result when nothing in the form changes (a save under a name does not)', async () => {
    const { user } = await withResult();
    await user.click(button(/Save as/) as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Copy');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('funnel-result')).toBeInTheDocument();
  });

  it('drops the answer of a query that is still on its way when the form changes', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubBackend({
      funnels: [funnelRow('Mine', ['a', 'b'], 12)],
      funnel: async (steps) => {
        await gate;
        return steps.map((eventName, i) => ({
          eventName,
          count: 10 - i,
          conversionFromPrevious: i === 0 ? null : 0.9,
        }));
      },
    });
    renderPage(<FunnelPage />);
    const user = userEvent.setup();
    await choose(user, 'Mine');
    await waitFor(() => expect(stepTags()).toEqual(['a', 'b']));
    await addStep(user, 'c');
    release();
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.queryByTestId('funnel-result')).toBeNull();
  });
});

describe('the funnel page: the first range', { timeout: 40000 }, () => {
  it('starts with the longest range the backend allows when that is shorter than 7 days', async () => {
    signIn('support', { codes: MANAGE, meta: { analyticsLiveMaxRangeDays: 3 } });
    const { user, calls } = await openPage();
    await addStep(user, 'a');
    await addStep(user, 'b');
    await user.click(queryButton());
    await waitFor(() => expect(funnelCalls(calls)).toHaveLength(1));
    const url = lastFunnel(calls);
    expect(
      Date.parse(`${url.searchParams.get('to')}T00:00:00Z`) -
        Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(2 * 86400000);
  });
});

describe('the funnel page: the explanation', { timeout: 40000 }, () => {
  it('says that the same account has to do the steps in order inside the window, and that the distinct counts are not added over days', async () => {
    await openPage();
    const text = document.body.textContent as string;
    expect(text).toContain(
      'The same account has to complete the steps in order within the window to count',
    );
    expect(text).toContain('Distinct counts are not added up across days');
    expect(text).toContain('longest time allowed between two neighbouring steps');
    // who is counted: what the contract says, in its three steps
    expect(text).toContain('the account of the event');
    expect(text).toContain('the device itself');
  });
});
