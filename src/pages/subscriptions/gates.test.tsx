import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore, subscriptionsState } from '../../../mock/_core/subscriptionsData';
import * as configMock from '../../../mock/config.mock';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { holdRequests } from '../../../tests/heldRequests';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { CONFIG_SCHEMA } from '../config/configSchema';
import GatesPage from './gates';

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetSubscriptionsStore();
  signInAs('root');
  as([], true);
});
afterEach(() => vi.unstubAllGlobals());

const setDefault = (key: string, mode: 'VALUE' | 'UNLIMITED' | 'UNSET', value: unknown = null) => {
  const gate = subscriptionsState().gates.find((g) => g.key === key);
  if (gate) {
    gate.defaultMode = mode;
    gate.defaultValue = value;
  }
};
const rowOf = async (key: string) => {
  const cell = await screen.findByText(key, { selector: 'code' });
  return cell.closest('tr') as HTMLElement;
};
const writes = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

describe('the red bars', { timeout: 30000 }, () => {
  it('shows both bars when none of the three call defaults and none of the two text defaults is configured', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    expect(
      await screen.findByText('Call quota is not configured: free users cannot make calls.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Text quota is not configured: free users cannot send text messages.'),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.ant-alert-error').length).toBeGreaterThanOrEqual(2);
  });

  it.each(['call.daily_minutes', 'call.monthly_minutes', 'call.lifetime_minutes'])(
    'shows no call bar when only %s is configured',
    async (key) => {
      setDefault(key, 'VALUE', 10);
      useMockBackend(subscriptionsMock, configMock);
      renderPage(<GatesPage />);
      await rowOf(key);
      expect(screen.queryByText(/Call quota is not configured/)).toBeNull();
      expect(screen.getByText(/Text quota is not configured/)).toBeInTheDocument();
    },
  );

  it.each(['chat.daily_messages', 'chat.monthly_messages'])(
    'shows no text bar when only %s is configured, and the call bar stays',
    async (key) => {
      setDefault(key, 'UNLIMITED');
      useMockBackend(subscriptionsMock, configMock);
      renderPage(<GatesPage />);
      await rowOf(key);
      expect(screen.queryByText(/Text quota is not configured/)).toBeNull();
      expect(screen.getByText(/Call quota is not configured/)).toBeInTheDocument();
    },
  );

  it('has no bar at all once one call switch and one text switch are set', async () => {
    setDefault('call.monthly_minutes', 'VALUE', 0);
    setDefault('chat.daily_messages', 'VALUE', 30);
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    await rowOf('call.daily_minutes');
    expect(document.querySelectorAll('.ant-alert-error')).toHaveLength(0);
  });

  it('removes a bar when the default that was missing is saved', async () => {
    const calls = useMockBackend(subscriptionsMock, configMock);
    const user = userEvent.setup();
    renderPage(<GatesPage />);
    const row = await rowOf('chat.daily_messages');
    await user.click(within(row).getByRole('button', { name: 'Edit default' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByText('Value'));
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '20' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByText(/Text quota is not configured/)).toBeNull());
    expect(writes(calls)).toHaveLength(1);
    expect(screen.getByText(/Call quota is not configured/)).toBeInTheDocument();
  });
});

describe('the default value column', { timeout: 30000 }, () => {
  it('shows a number, "No limit" and "Not configured" differently, and on/off and text for the others', async () => {
    setDefault('call.daily_minutes', 'VALUE', 5);
    setDefault('call.monthly_minutes', 'UNLIMITED');
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    expect(within(await rowOf('call.daily_minutes')).getAllByText('5').length).toBeGreaterThan(0);
    expect(within(await rowOf('call.monthly_minutes')).getByText('No limit')).toBeInTheDocument();
    expect(
      within(await rowOf('call.lifetime_minutes')).getByText('Not configured'),
    ).toBeInTheDocument();
    expect(within(await rowOf('ads.removed')).getByText('Off')).toBeInTheDocument();
    expect(within(await rowOf('memory.tier')).getByText('default')).toBeInTheDocument();
  });

  it('shows type, scope and the description of the server', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const row = await rowOf('call.daily_minutes');
    expect(within(row).getByText('Limit')).toBeInTheDocument();
    expect(within(row).getByText('Per period')).toBeInTheDocument();
    expect(within(row).getByText('Call minutes per local day')).toBeInTheDocument();
    expect(within(await rowOf('ads.removed')).getByText('Switch')).toBeInTheDocument();
    expect(within(await rowOf('assets.avatar_max')).getByText('Permanent')).toBeInTheDocument();
  });

  it('explains call.lifetime_minutes: only accounts created afterwards, existing grants unchanged, first session records it', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const row = await rowOf('call.lifetime_minutes');
    const note = within(row).getByText(/Only affects accounts created afterwards/);
    expect(note.textContent).toMatch(/already granted to existing accounts does not change/);
    expect(note.textContent).toMatch(/first session/);
    // the other rows have no such note
    expect(screen.getAllByText(/Only affects accounts created afterwards/)).toHaveLength(1);
  });
});

describe('editing a default', { timeout: 30000 }, () => {
  const open = async (key: string) => {
    const user = userEvent.setup();
    const row = await rowOf(key);
    await user.click(within(row).getByRole('button', { name: 'Edit default' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };

  it('offers "Not configured" for the five quota keys only', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    for (const key of [
      'call.daily_minutes',
      'call.monthly_minutes',
      'call.lifetime_minutes',
      'chat.daily_messages',
      'chat.monthly_messages',
    ]) {
      const { user, dialog } = await open(key);
      expect(within(dialog).getByText('Not configured')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    for (const key of [
      'assets.avatar_max',
      'memory.tier',
      'ads.removed',
      'avatar.looks_max',
      'credits.period_grant',
    ]) {
      const { user, dialog } = await open(key);
      expect(within(dialog).queryByText('Not configured'), key).toBeNull();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    // ten dialogs are opened and closed one after the other, which takes long when the machine is busy
  }, 120000);

  it('does not offer "No limit" for credits.period_grant, but does for avatar.looks_max', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const grant = await open('credits.period_grant');
    expect(within(grant.dialog).queryByText('No limit')).toBeNull();
    await grant.user.click(within(grant.dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const looks = await open('avatar.looks_max');
    expect(within(looks.dialog).getByText('No limit')).toBeInTheDocument();
  });

  it('sends {mode:UNSET}, {mode:UNLIMITED} and {mode:VALUE,value} for the three states', async () => {
    setDefault('call.daily_minutes', 'VALUE', 5);
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    let { user, dialog } = await open('call.daily_minutes');
    await user.click(within(dialog).getByText('Not configured'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/feature-gates/call.daily_minutes/default',
      body: { mode: 'UNSET' },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    ({ user, dialog } = await open('call.daily_minutes'));
    await user.click(within(dialog).getByText('No limit'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[1].body).toEqual({ mode: 'UNLIMITED' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    ({ user, dialog } = await open('call.daily_minutes'));
    await user.click(within(dialog).getByText('Value'));
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '45' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(3));
    expect(writes(calls)[2].body).toEqual({ mode: 'VALUE', value: 45 });
  });

  it('asks for a number before sending a VALUE with none', async () => {
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { user, dialog } = await open('call.daily_minutes');
    await user.click(within(dialog).getByText('Value'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('It must not be empty.')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the refusal of the backend in the dialog and keeps it open', async () => {
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { user, dialog } = await open('memory.tier');
    const box = within(dialog).getByRole('textbox');
    fireEvent.change(box, { target: { value: 'no-such-tier' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
  });

  it('sends one request however many times Save is clicked', async () => {
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { dialog } = await open('call.daily_minutes');
    fireEvent.click(within(dialog).getByText('No limit'));
    const save = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send again when the token ended during the save, and the dialog stays usable', async () => {
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') === 'GET' && url.includes('/feature-gates'))
        return jsonResponse(200, envelope('200', { items: subscriptionsState().gates }));
      if ((init.method ?? 'GET') === 'GET')
        return jsonResponse(200, envelope('200', { items: [] }));
      return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
    });
    const user = userEvent.setup();
    renderPage(<GatesPage />);
    const row = await rowOf('call.daily_minutes');
    await user.click(within(row).getByRole('button', { name: 'Edit default' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByText('No limit'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});

describe('the credit price column', { timeout: 30000 }, () => {
  const price = async (key: string) =>
    within(await rowOf(key)).getByRole('spinbutton', { name: `Credit price of ${key}` });

  it('can be edited only for a permanent limit, and not for avatar.looks_max or credits.period_grant', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    expect(await price('assets.avatar_max')).toBeEnabled();
    expect(await price('assets.voice_max')).toBeEnabled();
    for (const key of [
      'avatar.looks_max',
      'credits.period_grant',
      'call.daily_minutes',
      'call.monthly_minutes',
      'call.lifetime_minutes',
      'chat.daily_messages',
      'chat.monthly_messages',
      'ads.removed',
      'memory.tier',
      'chat.model_tier',
      'render.cloud',
    ]) {
      expect(await price(key), key).toBeDisabled();
    }
  });

  it('shows the price from the server and a dash for none', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    expect(await price('assets.avatar_max')).toHaveValue('30');
    expect(await price('avatar.looks_max')).toHaveValue('');
  });

  it('saves the new price with { creditCost } and clears it with null', async () => {
    const calls = useMockBackend(subscriptionsMock, configMock);
    const user = userEvent.setup();
    renderPage(<GatesPage />);
    const input = await price('assets.avatar_max');
    fireEvent.change(input, { target: { value: '45' } });
    await user.click(
      within(await rowOf('assets.avatar_max')).getByRole('button', { name: 'Save price' }),
    );
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/feature-gates/assets.avatar_max/credit-cost',
      body: { creditCost: 45 },
    });
    await waitFor(() =>
      expect(
        subscriptionsState().gates.find((g) => g.key === 'assets.avatar_max')?.creditCost,
      ).toBe(45),
    );
    fireEvent.change(await price('assets.avatar_max'), { target: { value: '' } });
    await user.click(
      within(await rowOf('assets.avatar_max')).getByRole('button', { name: 'Save price' }),
    );
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[1].body).toEqual({ creditCost: null });
  });

  it('sends one request while the save of a price is under way, however often Save price is clicked then', async () => {
    useMockBackend(subscriptionsMock, configMock);
    const held = holdRequests((_, method) => method === 'PUT');
    renderPage(<GatesPage />);
    fireEvent.change(await price('assets.avatar_max'), { target: { value: '45' } });
    const save = within(await rowOf('assets.avatar_max')).getByRole('button', {
      name: 'Save price',
    });
    fireEvent.click(save);
    await waitFor(() => expect(held.started()).toBe(1));
    fireEvent.click(save);
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 150));
    expect(held.started()).toBe(1);
    held.release();
  });

  it('shows the prices the last read brought when the answer of an earlier read arrives late', async () => {
    useMockBackend(subscriptionsMock, configMock);
    // the 2nd read of the switches (after the first saved price) is held; the 3rd is not
    const held = holdRequests(
      (url, method) => method === 'GET' && url.endsWith('/feature-gates'),
      2,
    );
    renderPage(<GatesPage />);
    fireEvent.change(await price('assets.avatar_max'), { target: { value: '45' } });
    fireEvent.click(
      within(await rowOf('assets.avatar_max')).getByRole('button', { name: 'Save price' }),
    );
    await waitFor(() => expect(held.started()).toBe(2));
    fireEvent.change(await price('assets.voice_max'), { target: { value: '77' } });
    fireEvent.click(
      within(await rowOf('assets.voice_max')).getByRole('button', { name: 'Save price' }),
    );
    await waitFor(() =>
      expect(subscriptionsState().gates.find((g) => g.key === 'assets.voice_max')?.creditCost).toBe(
        77,
      ),
    );
    held.release();
    await new Promise((r) => setTimeout(r, 150));
    // the held read knew only the first price: it must not bring the second one back to its old value
    expect(await price('assets.voice_max')).toHaveValue('77');
    expect(await price('assets.avatar_max')).toHaveValue('45');
  });

  it('says which field and why when the backend refuses a price (out of range), not only that the request is invalid', async () => {
    useMockBackend(subscriptionsMock, configMock);
    const user = userEvent.setup();
    renderPage(<GatesPage />);
    fireEvent.change(await price('assets.avatar_max'), { target: { value: '2000000' } });
    await user.click(
      within(await rowOf('assets.avatar_max')).getByRole('button', { name: 'Save price' }),
    );
    expect(
      await screen.findByText(/creditCost: The value is outside the allowed range\./),
    ).toBeInTheDocument();
  });

  it('has no Save price button until the price is changed, and none for a row that cannot be edited', async () => {
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const row = await rowOf('assets.avatar_max');
    expect(within(row).queryByRole('button', { name: 'Save price' })).toBeNull();
    expect(
      within(await rowOf('avatar.looks_max')).queryByRole('button', { name: 'Save price' }),
    ).toBeNull();
  });
});

describe('who sees what', { timeout: 30000 }, () => {
  it('shows no edit buttons, no Save price and disabled prices to an administrator with only SUBSCRIPTION:VIEW', async () => {
    as(['SUBSCRIPTION:VIEW']);
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    await rowOf('call.daily_minutes');
    expect(screen.queryByRole('button', { name: 'Edit default' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save price' })).toBeNull();
    expect(
      await within(await rowOf('assets.avatar_max')).findByRole('spinbutton', {
        name: 'Credit price of assets.avatar_max',
      }),
    ).toBeDisabled();
    // the bars are information for anyone who can read the page
    expect(screen.getByText(/Call quota is not configured/)).toBeInTheDocument();
  });

  it('shows the Parameters section with the eight SUBSCRIPTION:CONFIG keys to an administrator who holds the code', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:CONFIG']);
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    await rowOf('call.daily_minutes');
    expect(await screen.findByText('Parameters')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(8),
    );
    const keys = [...document.querySelectorAll('[data-testid^="config-row-"]')]
      .map((e) => (e.getAttribute('data-testid') as string).replace('config-row-', ''))
      .sort();
    expect(keys).toEqual(
      CONFIG_SCHEMA.filter((spec) => spec.editPermission === 'SUBSCRIPTION:CONFIG')
        .map((spec) => spec.key)
        .sort(),
    );
  });

  it('does not render the Parameters section for an administrator without SUBSCRIPTION:CONFIG', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT']);
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    await rowOf('call.daily_minutes');
    expect(screen.queryByText('Parameters')).toBeNull();
    expect(document.querySelector('[data-testid^="config-row-"]')).toBeNull();
    expect(calls.some((c) => c.url === '/api/admin/config')).toBe(false);
  });
});

describe('failure and arbitrary text', { timeout: 30000 }, () => {
  it('shows a failed load with a retry', async () => {
    stubFetch(async () => jsonResponse(503, envelope('DEPENDENCY_UNAVAILABLE')));
    renderPage(<GatesPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps a long description in every language inside its cell', async () => {
    const gates = subscriptionsState().gates;
    gates[0].description = 'ก'.repeat(5000);
    gates[1].description = 'مرحبا '.repeat(300);
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    await rowOf(gates[0].key);
    const buttons = [...document.querySelectorAll('button[data-lines]')] as HTMLElement[];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.style.overflowWrap).toBe('anywhere');
  });
});
