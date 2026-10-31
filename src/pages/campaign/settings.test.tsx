import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import { saved } from '../../../mock/_core/configStore';
import * as campaignMock from '../../../mock/campaign.mock';
import * as configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import SettingsPage from './settings';
import { signIn } from './testSetup';

afterEach(() => vi.unstubAllGlobals());

const shownKeys = () =>
  [...document.querySelectorAll('[data-testid^="config-row-"]')]
    .map((e) => (e.getAttribute('data-testid') as string).replace('config-row-', ''))
    .sort();

const ATTRIBUTION_KEYS = [
  'attribution.click_expired_keep_days',
  'attribution.click_retention_days',
  'attribution.cost_batch_max',
  'attribution.cost_currency',
  'attribution.facebook_graph_version',
  'attribution.fingerprint_window_hours',
  'attribution.link_base_url',
  'attribution.other_platform_url',
  'attribution.play_store_url',
  'attribution.postback_enabled',
  'attribution.record_retention_days',
  'attribution.store_click_ip',
];

describe('the attribution parameter page', { timeout: 30000 }, () => {
  it('shows the twelve keys of ATTRIBUTION:MANAGE, and no key of another permission, also to the super administrator', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    await screen.findByTestId('config-row-attribution.cost_currency');
    expect(shownKeys()).toEqual(ATTRIBUTION_KEYS);
  });

  it('shows the same twelve to an administrator who has only ATTRIBUTION:MANAGE', async () => {
    signIn('support', { codes: ['ATTRIBUTION:MANAGE'] });
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    await screen.findByTestId('config-row-attribution.cost_batch_max');
    expect(shownKeys()).toEqual(ATTRIBUTION_KEYS);
  });

  it('says in which order an install is matched, and that what is left after the fingerprint is organic traffic', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    const note = await screen.findByTestId('campaign-settings-order');
    expect(note.textContent).toMatch(/signature block.*store referrer.*fingerprint.*organic/is);
    await waitFor(() => expect(shownKeys().length).toBe(12));
  });

  it('is written in Chinese too', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />, 'zh-CN');
    const note = await screen.findByTestId('campaign-settings-order');
    expect(note.textContent).toMatch(/安装包签名块.*商店来源.*指纹.*自然流量/s);
    await waitFor(() => expect(shownKeys().length).toBe(12));
  });
});

const CURRENCY = 'attribution.cost_currency';
const typeCurrency = async (value: string) => {
  const row = await screen.findByTestId(`config-row-${CURRENCY}`);
  fireEvent.change(within(row).getByRole('textbox'), { target: { value } });
  const save = within(row).getByRole('button', { name: /Save|保\s?存/ });
  await waitFor(() => expect(save).not.toBeDisabled());
  fireEvent.click(save);
  return row;
};

describe('the rule that the cost currency cannot change while cost rows exist', {
  timeout: 30000,
}, () => {
  it('says so on the page, in both languages: delete the costs row by row first, then change the currency', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    const note = await screen.findByTestId('campaign-settings-currency-lock');
    expect(note.textContent).toMatch(
      /cannot be changed while cost rows exist.*delete the costs one by one/is,
    );
  });

  it('says so in Chinese', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />, 'zh-CN');
    const note = await screen.findByTestId('campaign-settings-currency-lock');
    expect(note.textContent).toBe('已有成本行时不能改币种；先逐行删除成本再改。');
  });

  it('shows the words of the code under the currency when the save is refused, never the words of the backend', async () => {
    signIn('root');
    const calls = useMockBackend(configMock);
    renderPage(<SettingsPage />);
    const row = await typeCurrency('EUR');
    await waitFor(() => expect(within(row).getByRole('alert')).toBeInTheDocument());
    expect(within(row).getByRole('alert').textContent).toBe(
      'The currency cannot be changed because cost rows exist. Delete all the costs one by one on the Costs tab first, then change the currency.',
    );
    expect(row.textContent).not.toMatch(
      /one currency is used for all cost rows|outside the allowed range/i,
    );
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ value: 'EUR' });
    expect(saved.has(CURRENCY)).toBe(false);
  });

  it('shows it in Chinese too', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />, 'zh-CN');
    const row = await typeCurrency('EUR');
    await waitFor(() => expect(within(row).getByRole('alert')).toBeInTheDocument());
    expect(within(row).getByRole('alert').textContent).toBe(
      '已有成本行，不能改币种。请先在“投放成本”页签里逐行删除全部成本，再改币种。',
    );
  });

  it('shows the same words when the reset to USD is refused', async () => {
    signIn('root');
    saved.set(CURRENCY, {
      value: 'EUR',
      updatedAt: '2026-10-20T00:00:00Z',
      updatedBy: '',
      updatedByUsername: 'root',
    });
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    const row = await screen.findByTestId(`config-row-${CURRENCY}`);
    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: 'Reset to default' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(within(row).getByRole('alert').textContent).toMatch(
        /cannot be changed because cost rows exist/,
      ),
    );
    expect(saved.get(CURRENCY)?.value).toBe('EUR');
  });

  it('lets the currency change once every cost is deleted', async () => {
    signIn('root');
    campaignState.costs.length = 0;
    const calls = useMockBackend(configMock, campaignMock);
    renderPage(<SettingsPage />);
    await typeCurrency('EUR');
    await waitFor(() => expect(saved.get(CURRENCY)?.value).toBe('EUR'));
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});
