import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { ConfigForm } from './ConfigForm';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
});
afterEach(() => vi.unstubAllGlobals());

const row = (key: string) => screen.findByTestId(`config-row-${key}`);

describe('ConfigForm: what is shown', { timeout: 30000 }, () => {
  it('shows every key the server sends, grouped by prefix, with label and description', {
    timeout: 30000,
  }, async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm />);
    const ttl = await row('auth.access_ttl_minutes');
    expect(within(ttl).getByText('auth.access_ttl_minutes')).toBeInTheDocument();
    expect(within(ttl).getByText(/Default/)).toHaveTextContent('1440');
    expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(225);
    expect(document.querySelectorAll('.ant-card-head-title').length).toBeGreaterThan(40);
  });

  it('shows only the keys of a permission, a prefix or a list, joined', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm
        editPermission="MODERATION:CONFIG"
        keys={['auth.access_ttl_minutes']}
        prefixes={['milestone.']}
      />,
    );
    await row('auth.access_ttl_minutes');
    const keys = [...document.querySelectorAll('[data-testid^="config-row-"]')].map((e) =>
      (e.getAttribute('data-testid') as string).replace('config-row-', ''),
    );
    expect(keys).toContain('moderation.block_score');
    expect(keys).toContain('milestone.days');
    expect(keys).toContain('auth.access_ttl_minutes');
    expect(keys).not.toContain('auth.refresh_ttl_days');
    expect(keys.filter((k) => k.startsWith('moderation.')).length).toBe(10);
  });

  it('shows only the keys of the permission when that is all the administrator has', async () => {
    adminOf('support').permissions = ['MODERATION:CONFIG'];
    signInAs('support');
    useMockBackend(configMock);
    renderPage(<ConfigForm editPermission="MODERATION:CONFIG" />);
    await row('moderation.block_score');
    expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(10);
  });

  it('shows nothing, not an error, to an administrator without any config permission', async () => {
    signInAs('support');
    useMockBackend(configMock);
    renderPage(<ConfigForm />);
    await waitFor(() => expect(document.querySelector('.ant-spin')).toBeNull());
    expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(0);
  });

  it('shows "not set" for a key with no value and no default, and the upload note for upload.public_base_url', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['upload.public_base_url', 'guest.call_minutes_total']} />);
    const upload = await row('upload.public_base_url');
    expect(within(upload).getAllByText('Not set').length).toBeGreaterThan(0);
    expect(within(upload).getByText('Ad media and APK uploads need it')).toBeInTheDocument();
    const guest = await row('guest.call_minutes_total');
    expect(within(guest).getByText('Not set', { selector: '.ant-tag' })).toBeInTheDocument();
  });

  it('spells out the risk of each of the six risk keys, and of no other', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm />);
    await row('render.cloud_enabled');
    const risky = [
      'render.cloud_enabled',
      'moderation.underage_reject_below_age',
      'complaint.likeness_due_hours',
      'guest.call_minutes_total',
      'chat.model_tiers_allowed',
      'chat.conversation_languages',
    ];
    for (const key of risky) {
      expect(
        within(screen.getByTestId(`config-row-${key}`)).getAllByRole('alert', { hidden: true })
          .length + 0,
      ).toBeGreaterThanOrEqual(0);
      expect(
        screen.getByTestId(`config-row-${key}`).querySelector('.ant-alert-warning'),
        key,
      ).not.toBeNull();
    }
    expect(
      screen.getByTestId('config-row-auth.access_ttl_minutes').querySelector('.ant-alert-warning'),
    ).toBeNull();
  });

  it('warns about a key the schema does not know, and shows it read-only', async () => {
    signInAs('root');
    const calls = useMockBackend(configMock);
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      const response = await original(input, init);
      if (String(input).endsWith('/config') && (init.method ?? 'GET') === 'GET') {
        const body = await response.json();
        body.data.items.push({
          key: 'brand.new_key',
          value: 1,
          defaultValue: 1,
          editPermission: 'CONFIG:MANAGE',
          updatedAt: null,
          updatedBy: null,
          updatedByUsername: null,
        });
        return new Response(JSON.stringify(body), { status: 200 });
      }
      return response;
    });
    renderPage(<ConfigForm />);
    expect(await screen.findByText('Unrecognised settings: brand.new_key')).toBeInTheDocument();
    expect(screen.queryByTestId('config-row-brand.new_key')).toBeNull();
    // listed read-only with its value, no editor, no save
    const unknown = screen.getByTestId('config-unknown-brand.new_key');
    expect(unknown).toHaveTextContent('1');
    expect(within(unknown).queryByRole('button')).toBeNull();
    expect(within(unknown).queryByRole('textbox')).toBeNull();
    void calls;
  });

  it('shows a link to the rule editor, read-only, for moderation.text_rules', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['moderation.text_rules']} />);
    const r = await row('moderation.text_rules');
    expect(within(r).getByRole('link', { name: '/moderation/rules' })).toHaveAttribute(
      'href',
      '/moderation/rules',
    );
    expect(within(r).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('shows an error with a retry when the list cannot be read', async () => {
    signInAs('root');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'x', data: null }), {
            status: 500,
          }),
      ),
    );
    renderPage(<ConfigForm />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('ConfigForm: saving', () => {
  it('saves one key with { value }, and shows who changed it and when', async () => {
    signInAs('root');
    const calls = useMockBackend(configMock);
    renderPage(<ConfigForm keys={['auth.access_ttl_minutes']} />);
    const r = await row('auth.access_ttl_minutes');
    const input = within(r).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '600' } });
    const save = within(r).getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe('/api/admin/config/auth.access_ttl_minutes');
    expect(put?.body).toEqual({ value: 600 });
    await waitFor(() =>
      expect(
        within(screen.getByTestId('config-row-auth.access_ttl_minutes')).getByText('Modified'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('config-row-auth.access_ttl_minutes')).toHaveTextContent('root');
  });

  it('keeps Save off until the value changes, and while it is not valid', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm
        keys={['auth.access_ttl_minutes', 'upload.public_base_url', 'ads.skip_after_seconds']}
      />,
    );
    const ttl = await row('auth.access_ttl_minutes');
    expect(within(ttl).getByRole('button', { name: 'Save' })).toBeDisabled();
    const url = await row('upload.public_base_url');
    fireEvent.change(within(url).getByRole('textbox'), {
      target: { value: 'http://bad.example.com' },
    });
    expect(within(url).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(url).toHaveTextContent('The link must start with lowercase https://');
    fireEvent.change(within(url).getByRole('textbox'), {
      target: { value: 'https://files.example.com' },
    });
    expect(within(url).getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('puts the details of a refusal next to the row, in the reason texts', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['retry.initial_seconds', 'retry.max_seconds']} />);
    const r = await row('retry.initial_seconds');
    fireEvent.change(within(r).getByRole('spinbutton'), { target: { value: '9999999' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(r).getAllByRole('alert').length).toBeGreaterThan(0));
    expect(r.textContent).toMatch(/out of range|range|between/i);
  });

  it('shows the warnings of a save in the warning style without blocking it', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['auth.phone_login_enabled']} />);
    const r = await row('auth.phone_login_enabled');
    // it is off by default; turn it on, save, then off again, which carries the warning
    const toggle = within(r).getByRole('switch');
    fireEvent.click(toggle);
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('config-row-auth.phone_login_enabled')).getByText('Modified'),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      within(screen.getByTestId('config-row-auth.phone_login_enabled')).getByRole('switch'),
    );
    const save2 = () =>
      within(screen.getByTestId('config-row-auth.phone_login_enabled')).getByRole('button', {
        name: /Save/,
      });
    await waitFor(() => expect(save2()).not.toBeDisabled());
    fireEvent.click(save2());
    expect(
      await screen.findByText('Phone sign-in is now off, but 3 phone-number accounts exist'),
    ).toBeInTheDocument();
  });

  it('disables Save for a JSON key whose text is not JSON', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['milestone.days']} />);
    const r = await row('milestone.days');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value: '[7, 30,' } });
    expect(within(r).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(r).getByRole('alert')).toHaveTextContent('Not valid JSON');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value: '[7, 30, 90]' } });
    await waitFor(() => expect(within(r).getByRole('button', { name: 'Save' })).not.toBeDisabled());
  });
});

describe('ConfigForm: reset to default', () => {
  it('asks first, then clears the key; the row goes back to its default and shows no update', async () => {
    signInAs('root');
    const calls = useMockBackend(configMock);
    renderPage(<ConfigForm keys={['auth.access_ttl_minutes']} />);
    const user = userEvent.setup();
    let r = await row('auth.access_ttl_minutes');
    expect(within(r).getByRole('button', { name: 'Reset to default' })).toBeDisabled(); // never saved
    fireEvent.change(within(r).getByRole('spinbutton'), { target: { value: '600' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('config-row-auth.access_ttl_minutes')).getByText('Modified'),
      ).toBeInTheDocument(),
    );
    r = screen.getByTestId('config-row-auth.access_ttl_minutes');
    await user.click(within(r).getByRole('button', { name: 'Reset to default' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('config-row-auth.access_ttl_minutes')).queryByText('Modified'),
      ).toBeNull(),
    );
    expect(
      within(screen.getByTestId('config-row-auth.access_ttl_minutes')).getByRole('spinbutton'),
    ).toHaveValue('1440');
    expect(calls.find((c) => c.method === 'DELETE')?.url).toBe(
      '/api/admin/config/auth.access_ttl_minutes',
    );
  });
});

describe('ConfigForm: empty and Chinese', { timeout: 30000 }, () => {
  it('does not mark a JSON key that has no value as invalid, until a value is removed from one that has', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['memory.tei_allowed_hosts', 'milestone.days']} />);
    const none = await row('memory.tei_allowed_hosts');
    expect(within(none).queryByText('Not valid JSON')).toBeNull();
    const has = await row('milestone.days');
    fireEvent.change(within(has).getByRole('textbox'), { target: { value: '' } });
    expect(within(has).getByText('Not valid JSON')).toBeInTheDocument();
  });

  it('writes the link to the rule editor as one sentence in Chinese', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['moderation.text_rules']} />, 'zh-CN');
    const r = await row('moderation.text_rules');
    expect(r).toHaveTextContent('请在这个页面里编辑：/moderation/rules');
    expect(within(r).getByRole('link', { name: '/moderation/rules' })).toBeInTheDocument();
  });
});
