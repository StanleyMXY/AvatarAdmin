import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetSmsStore, smsState } from '../../../mock/_core/smsData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestLocation } from '../../../tests/stubs/umi-max';
import zhCN from '../../locales/zh-CN';
import { ConfigForm } from './ConfigForm';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetSmsStore();
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
    expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(250);
    // the backend keys the contract does not list yet are known rows, not "unrecognised settings"
    expect(screen.queryByText(/Unrecognised settings/)).toBeNull();
    expect(screen.queryByTestId(/^config-unknown-/)).toBeNull();
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
    expect(keys.filter((k) => k.startsWith('moderation.')).length).toBe(11);
  });

  it('scrolls to the row named by the address fragment', async () => {
    signInAs('root');
    useMockBackend(configMock);
    const scrolled: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push(this.getAttribute('data-testid') ?? '');
    });
    setTestLocation({ pathname: '/config', hash: '#guest.call_minutes_total' });
    renderPage(<ConfigForm keys={['guest.call_minutes_total', 'auth.access_ttl_minutes']} />);
    await row('guest.call_minutes_total');
    await waitFor(() => expect(scrolled).toEqual(['config-row-guest.call_minutes_total']));
  });

  it('scrolls nowhere for no fragment or for a fragment that is no key', async () => {
    signInAs('root');
    useMockBackend(configMock);
    const scrolled: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push(this.getAttribute('data-testid') ?? '');
    });
    setTestLocation({ pathname: '/config', hash: '#no.such.key' });
    renderPage(<ConfigForm keys={['guest.call_minutes_total']} />);
    await row('guest.call_minutes_total');
    await new Promise((r) => setTimeout(r, 100));
    expect(scrolled).toEqual([]);
  });

  it('leaves out the keys it is told to exclude, also when the permission or a prefix would show them', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm
        editPermission="MODERATION:CONFIG"
        prefixes={['auth.']}
        exclude={['moderation.text_rules', 'auth.access_ttl_minutes']}
      />,
    );
    await row('moderation.block_score');
    const keys = [...document.querySelectorAll('[data-testid^="config-row-"]')].map((e) =>
      (e.getAttribute('data-testid') as string).replace('config-row-', ''),
    );
    expect(keys).not.toContain('moderation.text_rules');
    expect(keys).not.toContain('auth.access_ttl_minutes');
    expect(keys.filter((k) => k.startsWith('moderation.')).length).toBe(10);
    expect(keys).toContain('auth.refresh_ttl_days');
  });

  it('shows only the keys of the permission when that is all the administrator has', async () => {
    adminOf('support').permissions = ['MODERATION:CONFIG'];
    signInAs('support');
    useMockBackend(configMock);
    renderPage(<ConfigForm editPermission="MODERATION:CONFIG" />);
    await row('moderation.block_score');
    expect(document.querySelectorAll('[data-testid^="config-row-"]').length).toBe(11);
    expect(screen.getByTestId('config-row-moderation.record_retention_days')).toBeInTheDocument();
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

  it('spells out the risk of each of the seven risk keys, and of no other', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm />);
    await row('render.cloud_enabled');
    const risky = [
      'chat.conversation_languages',
      'chat.model_tiers_allowed',
      'complaint.likeness_due_hours',
      'guest.call_minutes_total',
      'guest.device_retention_days',
      'moderation.underage_reject_below_age',
      'render.cloud_enabled',
    ];
    // every row of the page, not a chosen few: the rows with a risk warning are exactly the seven
    const warned = [...document.querySelectorAll('[data-testid^="config-row-"]')]
      .filter((e) => e.querySelector('.ant-alert-warning'))
      .map((e) => (e.getAttribute('data-testid') as string).replace('config-row-', ''))
      .sort();
    expect(warned).toEqual(risky);
    for (const key of risky) {
      const warning = screen.getByTestId(`config-row-${key}`).querySelector('.ant-alert-warning');
      expect(warning?.textContent?.length ?? 0, key).toBeGreaterThan(20);
    }
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

const EXTRA_WITH_TEXT = [
  'chat.moderation_global_concurrency',
  'export.parallelism',
  'ratelimit.apk_download_per_ip_per_min',
  'ratelimit.push_image_per_ip_per_min',
  'ratelimit.ad_media_per_ip_per_min',
  'analytics.funnel_max_concurrency',
  'integrity.app_attest_max_keys_per_device',
  'ratelimit.app_attest_challenge_per_ip_per_hour',
  'ratelimit.app_attest_key_per_ip_per_hour',
  'integrity.app_attest_unsupported_allowed',
  'events.store_client_ip',
  'ads.store_client_ip',
  'attribution.store_click_ip',
  'chat.message_retention_days',
  'voice.source_sample_retention_days',
  'guest.device_retention_days',
  'support.feedback_retention_days',
  'moderation.record_retention_days',
  'push.task_poll_seconds',
  'memory.call_timeout_seconds',
  'attribution.postback_enabled',
  'attribution.facebook_graph_version',
  'ratelimit.events_per_ip_per_minute',
  'chat.moderation_concurrency',
  'chat.moderation_deadline_ms',
];

describe('ConfigForm: the keys the backend has before the contract lists them', {
  timeout: 60000,
}, () => {
  it.each(['en-US', 'zh-CN'] as const)(
    'writes a name and a description for each of the 25 in %s',
    async (locale) => {
      signInAs('root');
      useMockBackend(configMock);
      renderPage(<ConfigForm keys={EXTRA_WITH_TEXT} />, locale);
      await row('export.parallelism');
      for (const key of EXTRA_WITH_TEXT) {
        const r = screen.getByTestId(`config-row-${key}`);
        const name = r.querySelector('strong')?.textContent ?? '';
        expect(name, key).not.toBe('');
        expect(name, key).not.toBe(key);
        // a description is a line of text of its own under the name
        const lines = [...r.querySelectorAll('span.ant-typography-secondary')].filter(
          (e) => !e.querySelector('code') && (e.textContent?.length ?? 0) > 12,
        );
        expect(lines.length, key).toBeGreaterThan(0);
      }
      if (locale === 'en-US') expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/);
    },
  );

  it('shows the switches as switches, and a number with its range', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['events.store_client_ip', 'chat.moderation_deadline_ms']} />);
    const flag = await row('events.store_client_ip');
    expect(within(flag).getByRole('switch')).toBeChecked();
    const deadline = await row('chat.moderation_deadline_ms');
    expect(within(deadline).getByRole('spinbutton')).toHaveAttribute('aria-valuemax', '2500');
    expect(within(deadline).getByRole('spinbutton')).toHaveAttribute('aria-valuemin', '100');
    expect(deadline).toHaveTextContent('2000');
  });

  it('spells out the warning of guest.device_retention_days, which lets guest credit be gained again', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['guest.device_retention_days', 'chat.message_retention_days']} />,
    );
    const guest = await row('guest.device_retention_days');
    expect(guest.querySelector('.ant-alert-warning')).not.toBeNull();
    expect(guest.textContent).toMatch(/new device|new allowance|again/i);
    expect(
      screen
        .getByTestId('config-row-chat.message_retention_days')
        .querySelector('.ant-alert-warning'),
    ).toBeNull();
  });

  it('saves a switch of a key of its own permission with { value }', async () => {
    adminOf('support').permissions = ['ATTRIBUTION:MANAGE'];
    signInAs('support');
    const calls = useMockBackend(configMock);
    renderPage(<ConfigForm editPermission="ATTRIBUTION:MANAGE" />);
    const r = await row('attribution.store_click_ip');
    fireEvent.click(within(r).getByRole('switch'));
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1));
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({
      url: '/api/admin/config/attribution.store_click_ip',
      body: { value: false },
    });
  });
});

const alertOf = (r: HTMLElement) => within(r).getByRole('alert');

describe('ConfigForm: a refusal that names two keys is shown on both rows, in the words of the code', {
  timeout: 30000,
}, () => {
  const CURRENCY_WORDS =
    'The allowed currencies must contain the default currency. To change the default, add the new currency to the allowed list first; to take the current default out of the list, change the default first.';

  it('shows the currency rule under the default currency and under the allowed currencies, and not the backend message', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['usage_price.default_currency', 'usage_price.allowed_currencies']} />,
    );
    const def = await row('usage_price.default_currency');
    fireEvent.change(within(def).getByRole('textbox'), { target: { value: 'EUR' } });
    fireEvent.click(within(def).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(def)).toHaveTextContent(CURRENCY_WORDS));
    const allowed = screen.getByTestId('config-row-usage_price.allowed_currencies');
    expect(alertOf(allowed)).toHaveTextContent(CURRENCY_WORDS);
    expect(document.body.textContent).not.toContain('must contain usage_price.default_currency');
    expect(document.body.textContent).not.toMatch(/outside the allowed range/i);
  });

  it('shows it from the allowed currencies too, in Chinese', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['usage_price.default_currency', 'usage_price.allowed_currencies']} />,
      'zh-CN',
    );
    const allowed = await row('usage_price.allowed_currencies');
    fireEvent.change(within(allowed).getByRole('textbox'), { target: { value: '["THB"]' } });
    const save = within(allowed).getByRole('button', { name: /保\s?存/ });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    const words =
      '允许的币种必须包含默认币种。要改默认币种，先把新币种加进允许列表；要把当前默认币种从列表里去掉，先改默认币种。';
    await waitFor(() => expect(alertOf(allowed)).toHaveTextContent(words));
    expect(
      alertOf(screen.getByTestId('config-row-usage_price.default_currency')),
    ).toHaveTextContent(words);
  });

  it('clears the other row at the next attempt, and when the save passes', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['usage_price.default_currency', 'usage_price.allowed_currencies']} />,
    );
    const allowed = await row('usage_price.allowed_currencies');
    fireEvent.change(within(allowed).getByRole('textbox'), { target: { value: '["THB"]' } });
    fireEvent.click(within(allowed).getByRole('button', { name: 'Save' }));
    const def = screen.getByTestId('config-row-usage_price.default_currency');
    await waitFor(() => expect(alertOf(def)).toBeInTheDocument());
    fireEvent.change(within(allowed).getByRole('textbox'), { target: { value: '["USD","THB"]' } });
    const again = () => within(allowed).getByRole('button', { name: /Save/ });
    await waitFor(() => expect(again()).not.toHaveClass('ant-btn-loading'));
    fireEvent.click(again());
    await waitFor(() => expect(within(def).queryByRole('alert')).toBeNull());
    expect(within(allowed).queryByRole('alert')).toBeNull();
  });

  it('changes the words of a refusal that is on show when the language is switched, on both rows', async () => {
    signInAs('root');
    useMockBackend(configMock);
    const keys = ['usage_price.default_currency', 'usage_price.allowed_currencies'];
    const view = renderPage(<ConfigForm keys={keys} />);
    const def = await row('usage_price.default_currency');
    fireEvent.change(within(def).getByRole('textbox'), { target: { value: 'EUR' } });
    fireEvent.click(within(def).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(alertOf(def)).toHaveTextContent(/must contain the default currency/),
    );
    view.rerender(
      <IntlProvider locale="zh-CN" messages={zhCN} onError={() => {}}>
        <App>
          <ConfigForm keys={keys} />
        </App>
      </IntlProvider>,
    );
    const words = /允许的币种必须包含默认币种/;
    expect(
      alertOf(screen.getByTestId('config-row-usage_price.default_currency')),
    ).toHaveTextContent(words);
    expect(
      alertOf(screen.getByTestId('config-row-usage_price.allowed_currencies')),
    ).toHaveTextContent(words);
  });

  it('shows the rule of catch-up minutes and poll seconds as a hint on both fields, also before any refusal', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['push.schedule_catchup_minutes', 'push.task_poll_seconds']} />);
    const hint =
      'Rule: catch-up minutes × 60 must be at least 600 + poll seconds; with the default values the catch-up must be at least 11.';
    for (const key of ['push.schedule_catchup_minutes', 'push.task_poll_seconds']) {
      const r = await row(key);
      expect(r).toHaveTextContent(hint);
      expect(within(r).queryByRole('alert')).toBeNull();
    }
  });

  it('shows the hint in Chinese', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['push.schedule_catchup_minutes', 'push.task_poll_seconds']} />,
      'zh-CN',
    );
    for (const key of ['push.schedule_catchup_minutes', 'push.task_poll_seconds'])
      expect(await row(key)).toHaveTextContent(
        'catch-up 分钟数×60 须 ≥ 600 + 轮询秒数；默认值下至少 11',
      );
  });

  it('shows the refusal of the catch-up minutes on that field only; the poll seconds keep the rule hint, not a range sentence for a value nobody changed', async () => {
    signInAs('root');
    const calls = useMockBackend(configMock);
    renderPage(<ConfigForm keys={['push.schedule_catchup_minutes', 'push.task_poll_seconds']} />);
    const catchup = await row('push.schedule_catchup_minutes');
    fireEvent.change(within(catchup).getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(within(catchup).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(catchup)).toBeInTheDocument());
    expect(alertOf(catchup)).toHaveTextContent(/1 to 10080/);
    const poll = screen.getByTestId('config-row-push.task_poll_seconds');
    expect(within(poll).queryByRole('alert')).toBeNull();
    expect(poll).not.toHaveTextContent(/at least 1,/);
    expect(poll).toHaveTextContent(/Rule: catch-up minutes × 60 must be at least 600/);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('shows the refusal of the poll seconds on that field only when it is the one saved', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['push.schedule_catchup_minutes', 'push.task_poll_seconds']} />);
    const poll = await row('push.task_poll_seconds');
    fireEvent.change(within(poll).getByRole('spinbutton'), { target: { value: '3100' } });
    fireEvent.click(within(poll).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(poll)).toBeInTheDocument());
    expect(alertOf(poll)).toHaveTextContent(/catch-up minutes × 60 must stay at least 600/);
    const catchup = screen.getByTestId('config-row-push.schedule_catchup_minutes');
    expect(within(catchup).queryByRole('alert')).toBeNull();
    expect(catchup).not.toHaveTextContent(/1 to 10080, and/);
  });

  it('shows a retention refusal on the statistics window it depends on, as the second key', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['stats.land_window_days', 'chat.message_retention_days']} />);
    const retention = await row('chat.message_retention_days');
    fireEvent.change(within(retention).getByRole('spinbutton'), { target: { value: '32' } });
    fireEvent.click(within(retention).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(retention).queryByRole('alert')).toBeNull());
    const window = screen.getByTestId('config-row-stats.land_window_days');
    fireEvent.change(within(window).getByRole('spinbutton'), { target: { value: '40' } });
    fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(retention)).toBeInTheDocument());
    expect(alertOf(retention)).toHaveTextContent(/more than the statistics look-back days/);
    expect(alertOf(window)).toBeInTheDocument();
  });
});

describe('ConfigForm: a refusal for something that is not a row', { timeout: 30000 }, () => {
  it('puts the words of the code at the top of the form when the detail names SmsTemplate, not a setting key', async () => {
    signInAs('root');
    useMockBackend(configMock);
    smsState.templates.clear();
    renderPage(<ConfigForm keys={['auth.phone_login_enabled', 'auth.access_ttl_minutes']} />);
    const r = await row('auth.phone_login_enabled');
    fireEvent.click(within(r).getByRole('switch'));
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    const top = await screen.findByTestId('config-refusals');
    expect(top).toHaveTextContent(
      'Phone sign-in cannot be turned on yet. There must be at least one enabled OTP SMS template in language en (not en-GB or en-US) with no country set. Add or enable one under SMS templates, then try again.',
    );
    expect(within(r).queryByText('Modified')).toBeNull(); // nothing was saved
    // the row says that the save was refused; the backend message is never shown
    expect(within(r).getByRole('alert')).toHaveTextContent(
      'Some input is not valid. Please check the fields and try again.',
    );
    expect(document.body.textContent).not.toContain('for every country (no country set)"');
    expect(document.body.textContent).not.toMatch(/The last enabled OTP template/);
  });

  it('says it in Chinese, and takes it away at the next attempt', async () => {
    signInAs('root');
    useMockBackend(configMock);
    smsState.templates.clear();
    renderPage(<ConfigForm keys={['auth.phone_login_enabled']} />, 'zh-CN');
    const r = await row('auth.phone_login_enabled');
    fireEvent.click(within(r).getByRole('switch'));
    fireEvent.click(within(r).getByRole('button', { name: /保\s?存/ }));
    expect(await screen.findByTestId('config-refusals')).toHaveTextContent(
      '还不能开启手机号登录：必须至少有一个启用的验证码短信模板，语言为 en（en-GB、en-US 不算），且不限国家。请先在“短信模板”里新增或启用一个，再重试。',
    );
    resetSmsStore();
    fireEvent.click(within(r).getByRole('button', { name: /保\s?存/ }));
    await waitFor(() => expect(screen.queryByTestId('config-refusals')).toBeNull());
  });

  it('shows no top box when the refusal names only rows', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(
      <ConfigForm keys={['usage_price.default_currency', 'usage_price.allowed_currencies']} />,
    );
    const def = await row('usage_price.default_currency');
    fireEvent.change(within(def).getByRole('textbox'), { target: { value: 'EUR' } });
    fireEvent.click(within(def).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(def)).toBeInTheDocument());
    expect(screen.queryByTestId('config-refusals')).toBeNull();
  });
});

describe('ConfigForm: a refusal the page has no words for never shows the backend message', {
  timeout: 30000,
}, () => {
  const refuseWith = async (
    code: string,
    status: number,
    data: unknown,
    key: string,
    locale: 'en-US' | 'zh-CN' = 'en-US',
  ) => {
    signInAs('root');
    useMockBackend(configMock);
    const mocked = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') !== 'PUT') return mocked(input, init);
      return new Response(JSON.stringify({ code, message: 'BACKEND-MSG-A', data }), { status });
    });
    renderPage(<ConfigForm keys={[key, 'auth.phone_login_enabled']} />, locale);
    const r = await row(key);
    fireEvent.change(within(r).getByRole('spinbutton'), { target: { value: '300' } });
    fireEvent.click(
      within(r).getByRole('button', { name: locale === 'zh-CN' ? /保\s?存/ : 'Save' }),
    );
    return r;
  };

  it.each([
    ['en-US', /The service refused this change/],
    ['zh-CN', /服务端拒绝了这次修改/],
  ] as const)(
    'says the general words of the key for a reason code it does not know, in %s',
    async (locale, words) => {
      const r = await refuseWith(
        'INVALID_REQUEST',
        400,
        { details: [{ ref: 'chat.moderation_deadline_ms', reason: 'WEIRD_REASON' }] },
        'chat.moderation_deadline_ms',
        locale,
      );
      await waitFor(() => expect(r.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0));
      expect(r).toHaveTextContent(words);
      expect(document.body.textContent).not.toContain('BACKEND-MSG-A');
      expect(document.body.textContent).not.toContain('WEIRD_REASON');
    },
  );

  it('keeps it out of the top box for a detail that names no row', async () => {
    const r = await refuseWith(
      'INVALID_REQUEST',
      400,
      { details: [{ ref: 'SmsTemplate', reason: 'WEIRD_REASON' }] },
      'chat.moderation_deadline_ms',
    );
    const top = await screen.findByTestId('config-refusals');
    expect(top).toHaveTextContent(/The service refused this change/);
    expect(within(r).getByRole('alert')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('BACKEND-MSG-A');
  });

  it('shows no message on the saved row for an error code the page has no words for', async () => {
    const r = await refuseWith('SOMETHING_NEW', 409, null, 'chat.moderation_deadline_ms');
    await waitFor(() => expect(within(r).getByRole('alert')).toBeInTheDocument());
    expect(within(r).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(document.body.textContent).not.toContain('BACKEND-MSG-A');
  });
});

describe('ConfigForm: the supported languages', { timeout: 30000 }, () => {
  it('says that each language needs its template file, with the languages the backend names, and no backend message', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['app.supported_locales']} />);
    const r = await row('app.supported_locales');
    fireEvent.change(within(r).getByRole('textbox'), {
      target: { value: '["en","th","ar","id","vi","es","zh-Hans"]' },
    });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(r)).toBeInTheDocument());
    expect(alertOf(r)).toHaveTextContent(
      'Not saved. Every language needs a notification template file that ships with the app version. Ship the file first, then add the language.',
    );
    // nothing the checklist does not say: not which language ships today, not a rule about en
    expect(alertOf(r).textContent).not.toMatch(/only English|ships now|must stay in the list/);
    expect(alertOf(r)).toHaveTextContent(
      'Languages without a template file: th, ar, id, vi, es, zh-Hans',
    );
    expect(document.body.textContent).not.toContain('without a notification template file:');
  });

  it('does not depend on the extra field: without data.missingLanguages the sentence still stands', async () => {
    signInAs('root');
    const original = globalThis.fetch;
    useMockBackend(configMock);
    const mocked = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const response = await mocked(input, init);
      if ((init.method ?? 'GET') === 'PUT') {
        const body = await response.json();
        delete body.data.missingLanguages;
        return new Response(JSON.stringify(body), { status: response.status });
      }
      return response;
    });
    void original;
    renderPage(<ConfigForm keys={['app.supported_locales']} />);
    const r = await row('app.supported_locales');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value: '["en","th"]' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(alertOf(r)).toHaveTextContent(/Every language needs a notification template file/),
    );
    expect(alertOf(r).textContent).not.toContain('Languages without a template file');
  });
});

describe('ConfigForm: the push default language', { timeout: 30000 }, () => {
  const saveLanguage = async (value: string, zh = false) => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={['push.default_locale']} />, zh ? 'zh-CN' : 'en-US');
    const r = await row('push.default_locale');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value } });
    fireEvent.click(within(r).getByRole('button', { name: zh ? /保\s?存/ : 'Save' }));
    return r;
  };

  it('says which recall reasons lack an enabled template in the new language, and what to do first', async () => {
    const r = await saveLanguage('sw');
    await waitFor(() => expect(alertOf(r)).toBeInTheDocument());
    expect(alertOf(r)).toHaveTextContent(
      'The default language cannot be changed to sw: these recall reasons have enabled templates but none in sw: Daily recall. Enable a sw template for each of them first.',
    );
    expect(document.body.textContent).not.toMatch(/push\.default_locale cannot be/);
    expect(screen.queryByTestId('config-refusals')).toBeNull();
  });

  it('says it in Chinese', async () => {
    const r = await saveLanguage('sw', true);
    await waitFor(() => expect(alertOf(r)).toBeInTheDocument());
    expect(alertOf(r)).toHaveTextContent(
      '默认语言不能改为 sw：这些召回原因有启用的模板、但没有 sw 的启用模板：每日召回。先为每个原因启用 sw 的模板。',
    );
  });

  it('shows every reason on its own as plain text, whatever the backend sends in the list', async () => {
    signInAs('root');
    useMockBackend(configMock);
    const mocked = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const response = await mocked(input, init);
      if ((init.method ?? 'GET') !== 'PUT') return response;
      const body = await response.json();
      body.data.defaultLocale = 'th';
      body.data.reasons = ['streak_at_risk', '<b>x</b>', 7, { a: 1 }, 'อารบิก ภาษาไทย'];
      return new Response(JSON.stringify(body), { status: 400 });
    });
    renderPage(<ConfigForm keys={['push.default_locale']} />);
    const r = await row('push.default_locale');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value: 'sw' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertOf(r)).toBeInTheDocument());
    const text = alertOf(r).textContent as string;
    expect(text).toContain('Streak at risk');
    expect(text).toContain('<b>x</b>');
    expect(text).toContain('7');
    expect(text).toContain('{"a":1}');
    expect(text).toContain('อารบิก ภาษาไทย');
    expect(alertOf(r).querySelector('b')).toBeNull();
  });

  it('still gives the rule when the answer has no language or reasons', async () => {
    signInAs('root');
    useMockBackend(configMock);
    const mocked = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const response = await mocked(input, init);
      if ((init.method ?? 'GET') !== 'PUT') return response;
      const body = await response.json();
      delete body.data.defaultLocale;
      delete body.data.reasons;
      return new Response(JSON.stringify(body), { status: 400 });
    });
    renderPage(<ConfigForm keys={['push.default_locale']} />);
    const r = await row('push.default_locale');
    fireEvent.change(within(r).getByRole('textbox'), { target: { value: 'sw' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(alertOf(r)).toHaveTextContent(
        /every recall reason with an enabled template needs an enabled template in it/,
      ),
    );
  });

  it('saves a language that every such reason has, and says the order of work in the description', async () => {
    const r = await saveLanguage('th');
    await waitFor(() => expect(within(r).getByText('Modified')).toBeInTheDocument());
    expect(within(r).queryByRole('alert')).toBeNull();
    expect(r).toHaveTextContent(
      /first enable a template in the new language for every recall reason/,
    );
  });
});
