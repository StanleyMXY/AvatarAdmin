import { render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import RolesPage from './roles';
import { jsonAnswer, overrideFetch, signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const inLanguage = (locale: 'en-US' | 'zh-CN') => (
  <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
    <App>
      <RolesPage />
    </App>
  </IntlProvider>
);

describe('the paged table of the system pages', () => {
  it('changes the whole failure bar to the new language when the language is switched, not only its frame', async () => {
    useMockBackend({ default: system }, { default: systemPermissions });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/roles' ? jsonAnswer(403, 'ADMIN_FORBIDDEN') : undefined,
    );
    const { rerender } = render(inLanguage('en-US'));
    const bar = () => document.querySelector('.ant-alert-error') as HTMLElement;
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(bar().textContent).toContain(`Failed to load: ${enUS['error.ADMIN_FORBIDDEN']}`);
    rerender(inLanguage('zh-CN'));
    const text = bar().textContent ?? '';
    expect(text).toContain(`加载失败：${zhCN['error.ADMIN_FORBIDDEN']}`);
    expect(text).not.toContain(enUS['error.ADMIN_FORBIDDEN']);
    expect(screen.queryByText(/Failed to load/)).toBeNull();
  });

  it('keeps the rows at the default size of the table, not the small one of the other lists', async () => {
    useMockBackend({ default: system }, { default: systemPermissions });
    render(inLanguage('en-US'));
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length).toBeGreaterThan(
        0,
      ),
    );
    const table = document.querySelector('.ant-table-wrapper .ant-table') as HTMLElement;
    expect(table.classList.contains('ant-table-small')).toBe(false);
    expect(table.classList.contains('ant-table-medium')).toBe(false);
  });
});
