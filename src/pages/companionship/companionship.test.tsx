import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import CompanionshipPage from './index';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  adminOf('support').permissions = ['COMPANIONSHIP:CONFIG'];
  signInAs('support');
});
afterEach(() => vi.unstubAllGlobals());

const bonding = () =>
  screen.findByRole('spinbutton', { name: 'Bonding stage starts at (BONDING)' });
const close = () => screen.getByRole('spinbutton', { name: 'Close stage starts at (CLOSE)' });
const burst = () =>
  screen.getByRole('spinbutton', { name: 'Gap that counts as one interaction (minutes)' });
const save = () => screen.getByRole('button', { name: /Save/ });
const puts = (calls: ReturnType<typeof useMockBackend>) => calls.filter((c) => c.method === 'PUT');

describe('the companionship page', () => {
  it('shows the three values from the server and the note that thresholds do not migrate data', async () => {
    useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    expect(await bonding()).toHaveValue('50');
    expect(close()).toHaveValue('150');
    expect(burst()).toHaveValue('30');
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getByText(/existing data is not migrated/)).toBeInTheDocument();
  });

  it('saves only what changed, one key per request', async () => {
    const calls = useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    fireEvent.change(await bonding(), { target: { value: '80' } });
    fireEvent.click(save());
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toBe('/api/admin/config/companionship.stage_thresholds');
    expect(puts(calls)[0].body).toEqual({ value: { BONDING: 80, CLOSE: 150 } });
    await screen.findByText('Saved');
    fireEvent.change(burst(), { target: { value: '45' } });
    fireEvent.click(save());
    await waitFor(() => expect(puts(calls)).toHaveLength(2));
    expect(puts(calls)[1].body).toEqual({ value: 45 });
  });

  it('does not send anything when nothing changed', async () => {
    const calls = useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    await bonding();
    fireEvent.click(save());
    expect(await screen.findByText('Nothing changed')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });

  it('refuses BONDING at or above CLOSE, without sending', async () => {
    const calls = useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    fireEvent.change(await bonding(), { target: { value: '150' } });
    fireEvent.click(save());
    expect(await screen.findByText(/range|between|valid/i)).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });

  it('refuses a threshold that is empty or not a whole number, without sending', async () => {
    const calls = useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    fireEvent.change(await bonding(), { target: { value: '' } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(puts(calls)).toHaveLength(0);
  });
});
