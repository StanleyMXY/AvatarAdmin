import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactElement } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import type { CheckinActivity } from '../../services/activity';
import { ActivityFormModal } from './ActivityFormModal';
import { activityState, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

// Umi keeps the page mounted and only gives the provider new messages; it is drawn again the same way.
const draw = (locale: 'en-US' | 'zh-CN', ui: ReactElement) => (
  <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
    <App>{ui}</App>
  </IntlProvider>
);

const dialog = (target: CheckinActivity) => (
  <ActivityFormModal target={target} open onClose={() => {}} onSaved={() => {}} />
);

describe('the sign-in activity dialog when the language is switched', () => {
  it('does not read the activity again, and keeps what was typed but not saved', async () => {
    const calls = useMockBackend({ default: activityMock });
    const target = activityState.activities[0] as unknown as CheckinActivity;
    const { rerender } = render(draw('en-US', dialog(target)));
    const name = await screen.findByRole('textbox', { name: enUS['activity.signin.form.name'] });
    fireEvent.change(name, { target: { value: 'ชื่อที่ยังไม่ได้บันทึก' } });
    const reads = () =>
      calls.filter((c) => c.method === 'GET' && c.url.includes('/checkin/activities/')).length;
    expect(reads()).toBe(1);

    rerender(draw('zh-CN', dialog(target)));

    expect(
      await screen.findByRole('textbox', { name: zhCN['activity.signin.form.name'] }),
    ).toHaveValue('ชื่อที่ยังไม่ได้บันทึก');
    expect(reads()).toBe(1);
  });

  it('writes the failure to read the activity again in the new language', async () => {
    const target = activityState.activities[0] as unknown as CheckinActivity;
    let fetched = 0;
    vi.stubGlobal('fetch', async () => {
      fetched += 1;
      return new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'x', data: null }), {
        status: 500,
      });
    });
    const { rerender } = render(draw('en-US', dialog(target)));
    expect(await screen.findByText(new RegExp(enUS['error.INTERNAL_ERROR']))).toBeInTheDocument();

    const before = fetched;
    rerender(draw('zh-CN', dialog(target)));

    expect(await screen.findByText(new RegExp(zhCN['error.INTERNAL_ERROR']))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(enUS['error.INTERNAL_ERROR']))).toBeNull();
    expect(fetched).toBe(before);
  });
});
