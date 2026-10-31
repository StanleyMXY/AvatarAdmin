import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type { ReactElement } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
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

  it('keeps what was typed when a save fails, and shows the refusal', async () => {
    useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    fireEvent.change(await bonding(), { target: { value: '80' } });
    fireEvent.change(burst(), { target: { value: '45' } });
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      if ((init.method ?? 'GET') === 'PUT' && String(input).endsWith('text_burst_minutes')) {
        return new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'x', data: null }), {
          status: 500,
        });
      }
      return original(input, init);
    });
    fireEvent.click(save());
    await waitFor(() =>
      expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(burst()).toHaveValue('45'); // not put back to 30
  });

  it('keeps a token that is not a whole number as typed and refuses it, without sending', async () => {
    const calls = useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    await bonding();
    const box = screen.getByRole('combobox', { name: 'Milestone days' });
    fireEvent.change(box, { target: { value: 'abc' } });
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 13 });
    fireEvent.click(save());
    await waitFor(() =>
      expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(puts(calls)).toHaveLength(0);
    expect(document.body.textContent).not.toContain('NaN');
  });

  // antd gives a number box 90px unless told otherwise; the fixed prefix text (BONDING, CLOSE) fills
  // that, and the box where the number goes is left 0 and 16px wide. Seen in all three themes.
  it('gives the two stage boxes room for the prefix text and the number, not the 90px default', async () => {
    useMockBackend(configMock);
    renderPage(<CompanionshipPage />);
    await bonding();
    for (const box of [bonding(), close()]) {
      const wrapper = (await box).closest<HTMLElement>('.ant-input-number');
      expect(Number.parseInt(wrapper?.style.width ?? '', 10)).toBeGreaterThanOrEqual(180);
    }
  });

  describe('when the language is switched', () => {
    // Umi keeps the page mounted and only gives the provider new messages; it is drawn again the same way.
    const draw = (locale: 'en-US' | 'zh-CN', ui: ReactElement) => (
      <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
        <App>{ui}</App>
      </IntlProvider>
    );
    const reads = (calls: ReturnType<typeof useMockBackend>) =>
      calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/config'));

    it('does not read the values again, and keeps what was typed but not saved', async () => {
      const calls = useMockBackend(configMock);
      const { rerender } = render(draw('en-US', <CompanionshipPage />));
      fireEvent.change(await bonding(), { target: { value: '99' } });
      fireEvent.change(burst(), { target: { value: '45' } });
      const before = reads(calls).length;
      rerender(draw('zh-CN', <CompanionshipPage />));
      await screen.findByRole('button', {
        name: new RegExp(zhCN['companionship.save'].split('').join('\\s?')),
      });
      expect(reads(calls)).toHaveLength(before);
      expect(screen.getByRole('spinbutton', { name: zhCN['companionship.bonding'] })).toHaveValue(
        '99',
      );
      expect(screen.getByRole('spinbutton', { name: zhCN['companionship.burst'] })).toHaveValue(
        '45',
      );
    });

    it('writes a refusal of the typed values again in the new language', async () => {
      const calls = useMockBackend(configMock);
      const { rerender } = render(draw('en-US', <CompanionshipPage />));
      fireEvent.change(await bonding(), { target: { value: '150' } });
      fireEvent.click(save());
      expect(await screen.findByText(enUS['reason.OUT_OF_RANGE'])).toBeInTheDocument();
      rerender(draw('zh-CN', <CompanionshipPage />));
      expect(await screen.findByText(zhCN['reason.OUT_OF_RANGE'])).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(enUS['reason.OUT_OF_RANGE'])).toBeNull());
      expect(puts(calls)).toHaveLength(0);
    });

    it('writes a failed save again in the new language, and keeps what was typed', async () => {
      useMockBackend(configMock);
      const { rerender } = render(draw('en-US', <CompanionshipPage />));
      fireEvent.change(await bonding(), { target: { value: '80' } });
      const original = globalThis.fetch;
      vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
        if ((init.method ?? 'GET') === 'PUT') {
          return new Response(
            JSON.stringify({ code: 'INTERNAL_ERROR', message: 'x', data: null }),
            { status: 500 },
          );
        }
        return original(input, init);
      });
      fireEvent.click(save());
      expect(await screen.findByText(enUS['error.INTERNAL_ERROR'])).toBeInTheDocument();
      rerender(draw('zh-CN', <CompanionshipPage />));
      expect(await screen.findByText(zhCN['error.INTERNAL_ERROR'])).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(enUS['error.INTERNAL_ERROR'])).toBeNull());
      expect(screen.getByRole('spinbutton', { name: zhCN['companionship.bonding'] })).toHaveValue(
        '80',
      );
    });

    it('writes the failure to load again in the new language, without reading again', async () => {
      const calls: string[] = [];
      vi.stubGlobal('fetch', async (input: string) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'x', data: null }), {
          status: 500,
        });
      });
      const { rerender } = render(draw('en-US', <CompanionshipPage />));
      expect(await screen.findByText(new RegExp(enUS['error.INTERNAL_ERROR']))).toBeInTheDocument();
      const before = calls.length;
      rerender(draw('zh-CN', <CompanionshipPage />));
      expect(await screen.findByText(new RegExp(zhCN['error.INTERNAL_ERROR']))).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(enUS['error.INTERNAL_ERROR']))).toBeNull();
      expect(calls).toHaveLength(before);
    });
  });
});
