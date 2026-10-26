import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import PlacementsPage from './placements';
import {
  adsState,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from './testSetup';

const backend = () => useMockBackend({ default: adsMock }, { default: configMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const tableRows = () =>
  [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')] as HTMLTableRowElement[];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const rowOf = async (slotKey: string) => {
  await waitFor(() => expect(tableRows().some((r) => r.textContent?.includes(slotKey))).toBe(true));
  return tableRows().find((r) => r.textContent?.includes(slotKey)) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<PlacementsPage />);
  await waitFor(() => expect(tableRows()).toHaveLength(4));
  return { calls, user };
};
const configKeys = () =>
  [...document.querySelectorAll('[data-testid^="config-row-"]')].map((e) =>
    (e.getAttribute('data-testid') as string).replace('config-row-', ''),
  );
const setConfig = (key: string, value: unknown) =>
  saved.set(key, {
    value,
    updatedAt: '2026-10-25T00:00:00.000Z',
    updatedBy: '1001',
    updatedByUsername: 'root',
  });
const dialog = () => screen.findByRole('dialog');
const placement = (slotKey: string) =>
  [...adsState.placements.values()].find((p) => p.slotKey === slotKey)!;

describe('the placement page: the notes', { timeout: 30000 }, () => {
  it('opens with the delivery checklist', async () => {
    await load();
    expect(screen.getByText(/Delivery checklist/)).toBeInTheDocument();
    expect(screen.getByTestId('ads-checklist-layers').querySelectorAll('li')).toHaveLength(5);
  });

  it('says that the master switch is off by default and hides every placement of the app while it is off', async () => {
    await load();
    const note = screen.getByTestId('ads-placements-notes').textContent ?? '';
    expect(note).toMatch(/master switch is off by default/i);
    expect(note).toMatch(/hides all placements/i);
  });

  it('says that the frequency cap and the cooldown can be set to 0 (no limit) to test, and put back afterwards', async () => {
    await load();
    const note = screen.getByTestId('ads-placements-notes').textContent ?? '';
    expect(note).toMatch(/set the frequency cap and the cooldown to 0 \(no limit\)/i);
    expect(note).toMatch(/set them back/i);
  });

  it('says that the frequency cap counts impressions: an ad that was prefetched but not shown does not use the allowance', async () => {
    await load();
    const note = screen.getByTestId('ads-placements-notes').textContent ?? '';
    expect(note).toMatch(/counted by impressions/i);
    expect(note).toMatch(/prefetched but not shown/i);
  });
});

describe('the global settings', { timeout: 30000 }, () => {
  it('shows the nine keys of ADS:PLACEMENT and neither the tenth key nor a word about it', async () => {
    await load();
    await waitFor(() => expect(configKeys()).toHaveLength(9));
    expect(configKeys().sort()).toEqual(
      [
        'ads.enabled',
        'ads.preload_enabled',
        'ads.preload_ttl_minutes',
        'ads.skip_after_seconds',
        'ads.force_close_seconds',
        'ads.history_feed_interval',
        'ads.call_end_interval',
        'ads.creative_aspect_tolerance_percent',
        'ads.reward_complete_grace_seconds',
      ].sort(),
    );
    expect(document.body.textContent).not.toContain('ads.log_retention_days');
    expect(
      document.querySelector('[data-testid="config-unknown-ads.log_retention_days"]'),
    ).toBeNull();
  });

  it('shows the same nine keys, and no warning about the tenth, to an administrator who has ADS:PLACEMENT only', async () => {
    signIn('support', { codes: ['ADS:PLACEMENT'] });
    backend();
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(configKeys()).toHaveLength(9));
    expect(document.body.textContent).not.toContain('log_retention');
    expect(document.querySelector('.ant-alert-warning')).toBeNull();
  });

  it('shows the warning of the backend after ads.skip_after_seconds above 5 is saved, and saves it all the same', async () => {
    const { calls, user } = await load();
    const row = await screen.findByTestId('config-row-ads.skip_after_seconds');
    const input = within(row).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '8');
    await user.click(within(row).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/config/ads.skip_after_seconds',
      body: { value: 8 },
    });
    expect(await within(row).findByText(/The skip delay is over 5 seconds/i)).toBeInTheDocument();
    expect(saved.get('ads.skip_after_seconds')?.value).toBe(8);
  });

  it('shows the warning of the backend after ads.force_close_seconds is saved as 0', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname === '/api/admin/config/ads.force_close_seconds'
        ? jsonAnswer(200, '200', {
            key: 'ads.force_close_seconds',
            value: 0,
            warnings: [{ code: 'AD_FORCE_CLOSE_DISABLED', message: 'x' }],
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<PlacementsPage />);
    const row = await screen.findByTestId('config-row-ads.force_close_seconds');
    const input = within(row).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '0');
    await user.click(within(row).getByRole('button', { name: 'Save' }));
    expect(await within(row).findByText(/Forced close is set to 0/i)).toBeInTheDocument();
  });
});

describe('the warnings that stay on the page', { timeout: 30000 }, () => {
  const warnings = () => screen.queryByTestId('ads-placements-warnings');

  it('shows none when the skip countdown is 5 or less and the force-close is on', async () => {
    await load();
    await waitFor(() => expect(configKeys()).toHaveLength(9));
    expect(warnings()).toBeNull();
  });

  it('warns that a skip countdown above 5 seconds risks the store policy, and does not stop anything', async () => {
    setConfig('ads.skip_after_seconds', 8);
    await load();
    const box = await screen.findByTestId('ads-placements-warnings');
    expect(box.textContent).toMatch(/Full-screen ads must be easy to close/);
    expect(box.textContent).toMatch(/Google Play/);
  });

  it('takes the warning away, and puts it there, as soon as the setting is saved (no page reload)', async () => {
    setConfig('ads.skip_after_seconds', 8);
    const { user } = await load();
    await screen.findByTestId('ads-placements-warnings');
    const row = await screen.findByTestId('config-row-ads.skip_after_seconds');
    const input = within(row).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5');
    await user.click(within(row).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(warnings()).toBeNull());
    expect(saved.get('ads.skip_after_seconds')?.value).toBe(5);
    const rowAgain = () => within(screen.getByTestId('config-row-ads.skip_after_seconds'));
    await waitFor(() => expect(rowAgain().getByRole('spinbutton')).toHaveValue('5'));
    await user.clear(rowAgain().getByRole('spinbutton'));
    await user.type(rowAgain().getByRole('spinbutton'), '9');
    await user.click(rowAgain().getByRole('button', { name: /Save/ }));
    expect(await screen.findByTestId('ads-placements-warnings')).toBeInTheDocument();
  });

  it('warns about the force-close of 0 and says how many creatives without a skip there are on the full-screen placements', async () => {
    setConfig('ads.force_close_seconds', 0);
    await load();
    const box = await screen.findByTestId('ads-placements-warnings');
    expect(box.textContent).toMatch(/Forced close \(ads\.force_close_seconds\) is 0/);
    expect(box.textContent).toMatch(/1 creative/);
  });

  it('does not warn about the force-close of 0 when no full-screen creative is without a skip', async () => {
    setConfig('ads.force_close_seconds', 0);
    for (const creative of adsState.creatives.values()) creative.skippable = true;
    await load();
    await waitFor(() => expect(configKeys()).toHaveLength(9));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warnings()).toBeNull();
  });

  it('does not count a creative without a skip on a native placement', async () => {
    setConfig('ads.force_close_seconds', 0);
    for (const creative of adsState.creatives.values()) creative.skippable = true;
    adsState.creatives.get('9')!.skippable = false; // on a unit of the native placement
    await load();
    await waitFor(() => expect(configKeys()).toHaveLength(9));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warnings()).toBeNull();
  });

  it('warns without a count when the creatives cannot be read for lack of ADS:CREATIVE', async () => {
    setConfig('ads.force_close_seconds', 0);
    signIn('support', { codes: ['ADS:PLACEMENT'] });
    setConfig('ads.force_close_seconds', 0);
    backend();
    renderPage(<PlacementsPage />);
    const box = await screen.findByTestId('ads-placements-warnings');
    expect(box.textContent).toMatch(/Forced close \(ads\.force_close_seconds\) is 0/);
    expect(box.textContent).toMatch(/cannot be checked here/i);
    expect(box.textContent).not.toMatch(/\d+ creative/);
  });
});

describe('the placement table', { timeout: 30000 }, () => {
  it('has the columns of the spec in its order', async () => {
    await load();
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      'Slot key',
      'Format',
      'Name',
      'Enabled',
      'Frequency cap',
      'Cooldown (minutes)',
      'Reward credits',
      'Creative spec',
      'Actions',
    ]);
  });

  it('lists the four placements, each with its format, and offers no way to add or delete one', async () => {
    await load();
    expect(tableRows().map((r) => cellsOf(r)[0])).toEqual([
      'app_open',
      'call_end',
      'history_feed',
      'reward_credits',
    ]);
    expect(cellsOf(await rowOf('app_open'))[1]).toBe('Splash');
    expect(cellsOf(await rowOf('call_end'))[1]).toBe('Interstitial');
    expect(cellsOf(await rowOf('history_feed'))[1]).toBe('Native');
    expect(cellsOf(await rowOf('reward_credits'))[1]).toBe('Rewarded');
    expect(screen.queryByRole('button', { name: /new|add|create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows the cap, with 0 as "no limit", the cooldown as a dash for the rewarded placement, and the reward only for it', async () => {
    await load();
    const open = cellsOf(await rowOf('app_open'));
    expect(open[4]).toContain('2');
    expect(open[5]).toBe('30');
    expect(open[6]).toBe('—');
    const feed = cellsOf(await rowOf('history_feed'));
    expect(feed[5]).toContain('0');
    expect(feed[5]).toMatch(/no cooldown/i);
    const rewarded = cellsOf(await rowOf('reward_credits'));
    expect(rewarded[4]).toContain('5');
    expect(rewarded[5]).toBe('—');
    expect(rewarded[6]).toContain('10');
  });

  it('says on the rewarded row that the cap is also the number of rewards of a day and cannot be 0, and shows what an account can earn a day', async () => {
    await load();
    const rewarded = await rowOf('reward_credits');
    expect(cellsOf(rewarded)[4]).toMatch(/cannot be 0/i);
    expect(cellsOf(rewarded)[6]).toMatch(/50/);
    expect(cellsOf(rewarded)[6]).toMatch(/frequency cap × reward credits/i);
    const open = cellsOf(await rowOf('app_open'));
    expect(open[4]).toMatch(/0 = no limit/i);
  });

  it('shows 0 and a cap that was set to 0 as it is, not as nothing, and a missing value as a dash', async () => {
    backend();
    adsState.placements.get('1')!.frequencyCap = 0;
    (adsState.placements.get('2') as { frequencyCap: unknown }).frequencyCap = null;
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    expect(cellsOf(await rowOf('app_open'))[4]).toMatch(/^0/);
    expect(cellsOf(await rowOf('call_end'))[4]).toMatch(/^—/);
  });

  it('shows the spec of the file: the ratio, the shorter side in pixels and the largest size', async () => {
    await load();
    const spec = cellsOf(await rowOf('app_open'))[7];
    expect(spec).toContain('9:16');
    expect(spec).toContain('720');
    expect(spec).toContain('10 MB');
  });

  it('shows a name of 300 letters without a space inside the table', async () => {
    backend();
    adsState.placements.get('3')!.name = 'ก'.repeat(300);
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    const buttons = [...document.querySelectorAll('.ant-table-tbody button[data-lines]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
    }
  });

  it('does not break on a row whose fields have the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/placements') return undefined;
      return jsonAnswer(200, '200', {
        items: [
          {
            id: '1',
            slotKey: 5,
            adFormat: 'WEIRD',
            name: { x: 1 },
            enabled: 'yes',
            frequencyCap: '2',
            rewardCredits: [],
          },
        ],
      });
    });
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(document.body.textContent).toContain('WEIRD');
  });

  it('is written in Chinese too', async () => {
    backend();
    renderPage(<PlacementsPage />, 'zh-CN');
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      '广告位键',
      '形式',
      '名称',
      '启用',
      '频控',
      '冷却（分钟）',
      '奖励额度',
      '素材规格',
      '操作',
    ]);
    expect(screen.getByText(/投放检查清单/)).toBeInTheDocument();
    expect(screen.getByTestId('ads-placements-notes').textContent).toMatch(/总开关默认关闭/);
  });
});

describe('the enabled switch', { timeout: 30000 }, () => {
  it('sends the new state alone at once, and shows what the backend holds', async () => {
    const { calls, user } = await load();
    const row = await rowOf('app_open');
    await user.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/ads/placements/${placement('app_open').id}`,
      body: { enabled: false },
    });
    await waitFor(() =>
      expect(
        within(tableRows().find((r) => r.textContent?.includes('app_open'))!).getByRole('switch'),
      ).not.toBeChecked(),
    );
  });

  it('sends one request when it is pressed twice', async () => {
    const { calls, user } = await load();
    const gate = holdWrites();
    const toggle = within(await rowOf('app_open')).getByRole('switch');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
    void user;
  });

  it('says why in the words of the code when the backend refuses, and never with the backend words', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    await user.click(within(await rowOf('app_open')).getByRole('switch'));
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('is not there for an administrator without ADS:PLACEMENT, and neither is Edit (the list is read with ADS:UNIT)', async () => {
    signIn('support', { codes: ['ADS:UNIT'] });
    backend();
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    for (const toggle of document.querySelectorAll('.ant-table-tbody [role="switch"]')) {
      expect(toggle).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('the form of a placement', { timeout: 40000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, slotKey: string) => {
    await user.click(within(await rowOf(slotKey)).getByRole('button', { name: 'Edit' }));
    return within(await dialog());
  };

  it('has the frequency cap and the cooldown for an ordinary placement, and says what 0 means and that guests have no limit', async () => {
    const { user } = await load();
    const form = await open(user, 'app_open');
    expect(form.getByRole('spinbutton', { name: 'Frequency cap' })).toHaveValue('2');
    expect(form.getByRole('spinbutton', { name: 'Cooldown (minutes)' })).toHaveValue('30');
    expect(form.queryByRole('spinbutton', { name: 'Reward credits' })).not.toBeInTheDocument();
    expect(form.getByText(/0 = no limit/)).toBeInTheDocument();
    expect(form.getByText(/guests have no cap/i)).toBeInTheDocument();
  });

  it('sends only what was changed, and a cap of 0 is allowed here (to test, then put back)', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'app_open');
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '0');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/ads/placements/${placement('app_open').id}`,
      body: { frequencyCap: 0 },
    });
    await dialogsClosed();
    expect(placement('app_open').frequencyCap).toBe(0);
  });

  it('sends nothing when nothing was changed', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'app_open');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await dialogsClosed();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a cap that is negative or not whole, and the cooldown too', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'call_end');
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a whole number, 0 or more')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('has the reward and no cooldown for the rewarded placement; the cooldown is a dash that cannot be changed', async () => {
    const { user } = await load();
    const form = await open(user, 'reward_credits');
    expect(form.getByRole('spinbutton', { name: 'Reward credits' })).toHaveValue('10');
    expect(form.queryByRole('spinbutton', { name: 'Cooldown (minutes)' })).not.toBeInTheDocument();
    expect(form.getByTestId('ads-placement-cooldown-none')).toHaveTextContent('—');
    expect(
      form.getByText(/also the most rewards an account can get in a day/i),
    ).toBeInTheDocument();
  });

  it('does not take a cap of 0 on the rewarded placement, and says why, and sends nothing', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'reward_credits');
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '0');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText(/The rewarded placement cannot have a cap of 0/),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    expect(placement('reward_credits').frequencyCap).toBe(5);
  });

  it('does not take a reward of 0 or an empty one', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'reward_credits');
    const reward = form.getByRole('spinbutton', { name: 'Reward credits' });
    await user.clear(reward);
    await user.type(reward, '0');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The reward must be more than 0')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows, beside the reward, what an account can earn a day as the cap times the reward, and follows the typing', async () => {
    const { user } = await load();
    const form = await open(user, 'reward_credits');
    const shown = () => form.getByTestId('ads-placement-daily-max').textContent ?? '';
    expect(shown()).toMatch(
      /Most credits an account can earn from ads a day = frequency cap × reward credits = 5 × 10 = 50/,
    );
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '3');
    expect(shown()).toMatch(/3 × 10 = 30/);
    const reward = form.getByRole('spinbutton', { name: 'Reward credits' });
    await user.clear(reward);
    await user.type(reward, '20');
    expect(shown()).toMatch(/3 × 20 = 60/);
    await user.clear(cap);
    expect(shown()).toMatch(/= —/);
  });

  it('sends the changed cap and reward of the rewarded placement', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'reward_credits');
    const reward = form.getByRole('spinbutton', { name: 'Reward credits' });
    await user.clear(reward);
    await user.type(reward, '25');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ rewardCredits: 25 });
  });

  it('puts the reason of the backend under the field it names, and says it in the words of the reason', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'frequencyCap', reason: 'OUT_OF_RANGE' }] },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    const form = await open(user, 'app_open');
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '9');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await open(user, 'app_open');
    const cap = form.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '7');
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    // Enter in a field submits the form itself, after its check is over: still one request.
    const formElement = document.querySelector('.ant-modal form') as Element;
    fireEvent.submit(formElement);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('a session that ends while a write is on its way', { timeout: 30000 }, () => {
  it('shows that it has ended, in the words of the code, and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<PlacementsPage />);
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    await user.click(within(await rowOf('app_open')).getByRole('switch'));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('a dialog that is opened again', { timeout: 30000 }, () => {
  it('shows the placement that is edited, not the one that was edited before', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('app_open')).getByRole('button', { name: 'Edit' }));
    const first = within(await dialog());
    const cap = first.getByRole('spinbutton', { name: 'Frequency cap' });
    await user.clear(cap);
    await user.type(cap, '9');
    await user.click(first.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowOf('call_end')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('spinbutton', { name: 'Frequency cap' })).toHaveValue('3');
    expect(form.getByRole('spinbutton', { name: 'Cooldown (minutes)' })).toHaveValue('10');
  });
});
