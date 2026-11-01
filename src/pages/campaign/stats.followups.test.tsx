import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import campaignMock from '../../../mock/campaign.mock';
import configMock from '../../../mock/config.mock';
import statsMock from '../../../mock/stats.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import StatsPage from './stats';
import { NOW, signIn } from './testSetup';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the row of the unattributed installs', { timeout: 30000 }, () => {
  it('writes a short share in the cell, so that the column is not widened, and the whole sentence in the hint', async () => {
    signIn('root');
    useMockBackend({ default: campaignMock }, { default: configMock }, { default: statsMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<StatsPage />);
    const row = await screen.findByTestId('unattributed-row');
    const share = within(row).getByTestId('unattributed-share');
    expect(share.textContent).toMatch(/^Share: [\d.,]+%$/);
    expect(share.textContent).not.toContain('matched');
    await user.hover(share);
    await waitFor(() =>
      expect(document.body.textContent).toContain('Share of matched plus unattributed installs:'),
    );
  });

  it('keeps the share in Chinese as short, with the sentence in the hint', async () => {
    signIn('root');
    useMockBackend({ default: campaignMock }, { default: configMock }, { default: statsMock });
    renderPage(<StatsPage />, 'zh-CN');
    const row = await screen.findByTestId('unattributed-row');
    expect(within(row).getByTestId('unattributed-share').textContent).toMatch(/^占比：[\d.,]+%$/);
  });
});
