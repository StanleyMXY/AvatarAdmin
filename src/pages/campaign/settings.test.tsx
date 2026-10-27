import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  'attribution.fingerprint_window_hours',
  'attribution.link_base_url',
  'attribution.other_platform_url',
  'attribution.play_store_url',
  'attribution.record_retention_days',
];

describe('the attribution parameter page', { timeout: 30000 }, () => {
  it('shows the nine keys of ATTRIBUTION:MANAGE, and no key of another permission, also to the super administrator', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />);
    await screen.findByTestId('config-row-attribution.cost_currency');
    expect(shownKeys()).toEqual(ATTRIBUTION_KEYS);
  });

  it('shows the same nine to an administrator who has only ATTRIBUTION:MANAGE', async () => {
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
    await waitFor(() => expect(shownKeys().length).toBe(9));
  });

  it('is written in Chinese too', async () => {
    signIn('root');
    useMockBackend(configMock);
    renderPage(<SettingsPage />, 'zh-CN');
    const note = await screen.findByTestId('campaign-settings-order');
    expect(note.textContent).toMatch(/安装包签名块.*商店来源.*指纹.*自然流量/s);
    await waitFor(() => expect(shownKeys().length).toBe(9));
  });
});
