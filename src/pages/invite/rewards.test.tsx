import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RewardsPage from './rewards';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const KEYS = [
  'invite.reward_enabled',
  'invite.inviter_reward_credits',
  'invite.invitee_reward_credits',
  'invite.reward_trigger',
  'invite.first_call_min_seconds',
  'invite.max_rewarded_per_inviter',
  'invite.chain_max_depth',
  'invite.reward_start_at',
  'invite.reward_end_at',
];

describe('the invite reward settings page', { timeout: 30000 }, () => {
  it('shows the nine invite.* keys of INVITE:CONFIG and no other key', async () => {
    useMockBackend(configMock);
    renderPage(<RewardsPage />);
    for (const key of KEYS) {
      expect(await screen.findByTestId(`config-row-${key}`), key).toBeInTheDocument();
    }
    const shown = [...document.querySelectorAll('[data-testid^="config-row-"]')].map((e) =>
      e.getAttribute('data-testid'),
    );
    expect(shown.sort()).toEqual(KEYS.map((k) => `config-row-${k}`).sort());
  });

  it('shows the same nine keys to an administrator who only has INVITE:CONFIG', async () => {
    signIn('support', { codes: ['INVITE:CONFIG'] });
    useMockBackend(configMock);
    renderPage(<RewardsPage />);
    await screen.findByTestId('config-row-invite.reward_enabled');
    expect(document.querySelectorAll('[data-testid^="config-row-"]')).toHaveLength(9);
  });

  it('says that an amount is written into the invite record when it is paid out and that later changes only affect later payments', async () => {
    useMockBackend(configMock);
    renderPage(<RewardsPage />);
    const note = await screen.findByTestId('invite-rewards-note');
    expect(note.textContent).toBe(
      'The amounts are written into the invite record when they are paid out; changing them afterwards only affects what is paid out later.',
    );
    await screen.findByTestId('config-row-invite.chain_max_depth');
    expect(within(document.body).getAllByTestId('invite-rewards-note')).toHaveLength(1);
  });
});
