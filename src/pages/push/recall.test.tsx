import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import RecallPage from './recall';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
});
afterEach(() => vi.unstubAllGlobals());

const shownKeys = () =>
  [...document.querySelectorAll('[data-testid^="config-row-"]')]
    .map((e) => (e.getAttribute('data-testid') as string).replace('config-row-', ''))
    .sort();

const PUSH_CONFIG_KEYS = [
  'push.default_locale',
  'push.guest_token_retention_days',
  'push.schedule_catchup_minutes',
  'push.schedule_scan_seconds',
  'push.task_image_retention_days',
  'push.task_lease_minutes',
  'push.task_poll_seconds',
  'recall.inactive_hours',
  'recall.local_send_hour',
  'recall.min_gap_hours',
  'recall.scan_interval_minutes',
  'recall.streak_min_days',
  'recall.window_minutes',
];

describe('the recall parameter page', { timeout: 30000 }, () => {
  it('shows the thirteen keys of PUSH:CONFIG: recall.*, push.default_locale and the rest, and no other key', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<RecallPage />);
    await screen.findByTestId('config-row-recall.local_send_hour');
    expect(shownKeys()).toEqual(PUSH_CONFIG_KEYS);
  });

  it('shows the same thirteen to an administrator who has only PUSH:CONFIG, and nothing else', async () => {
    adminOf('support').permissions = ['PUSH:CONFIG'];
    signInAs('support');
    useMockBackend(configMock);
    renderPage(<RecallPage />);
    await screen.findByTestId('config-row-recall.window_minutes');
    expect(shownKeys()).toEqual(PUSH_CONFIG_KEYS);
  });

  it('says what the page is for', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<RecallPage />);
    expect(await screen.findByText(/parameters of the daily recall push/)).toBeInTheDocument();
    await waitFor(() => expect(shownKeys().length).toBe(13));
  });

  it('is written in Chinese too', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<RecallPage />, 'zh-CN');
    expect(await screen.findByText(/每日召回推送和推送发送的参数/)).toBeInTheDocument();
  });
});
