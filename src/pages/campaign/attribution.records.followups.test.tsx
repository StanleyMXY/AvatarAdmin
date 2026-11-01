import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import campaignMock from '../../../mock/campaign.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import AttributionPage from './attribution';
import { moneyText } from './figures';
import { jsonAnswer, NOW, overrideFetch, signIn } from './testSetup';

beforeEach(() => {
  signIn('root');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ACTIVE = '.ant-tabs-content-active';
const head = (name: string) =>
  [...document.querySelectorAll(`${ACTIVE} .ant-table-thead th`)].findIndex(
    (h) => h.textContent === name,
  );
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');

describe('the cost of an install that a third party reported', { timeout: 30000 }, () => {
  it('keeps the digits of a small cost: 0.004 is not shown as 0.00, and 12.3 still has two decimals', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/records'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 1,
                source: 'APPSFLYER',
                cost: 0.004,
                costCurrency: 'USD',
                costInSelectedCurrency: 0.0036,
              },
              {
                id: 2,
                source: 'APPSFLYER',
                cost: 12.3,
                costCurrency: 'USD',
                costInSelectedCurrency: 12.3,
              },
              {
                id: 3,
                source: 'APPSFLYER',
                cost: 0,
                costCurrency: 'USD',
                costInSelectedCurrency: 0,
              },
              {
                id: 4,
                source: 'APPSFLYER',
                cost: 1234.5678912,
                costCurrency: 'EUR',
                costInSelectedCurrency: 1234.5678912,
              },
            ],
            total: 4,
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Installs and registrations' }));
    await waitFor(() =>
      expect(document.querySelectorAll(`${ACTIVE} tbody tr.ant-table-row`)).toHaveLength(4),
    );
    const rows = [...document.querySelectorAll(`${ACTIVE} tbody tr.ant-table-row`)].map(cellsOf);
    const cost = head('Cost');
    const selected = head('Cost in selected currency');
    expect(rows[0][cost]).toBe('0.004 USD');
    expect(rows[0][selected]).toBe('0.0036');
    expect(rows[1][cost]).toBe('12.30 USD');
    expect(rows[2][cost]).toBe('0.00 USD');
    expect(rows[3][cost]).toBe('1,234.567891 EUR');
  });
});

describe('moneyText', () => {
  it('keeps two decimals by default and up to the number of decimals asked for when there are more', () => {
    expect(moneyText(12.3, 'en-US')).toBe('12.30');
    expect(moneyText(0.004, 'en-US')).toBe('0.00');
    expect(moneyText(0.004, 'en-US', 6)).toBe('0.004');
    expect(moneyText(12.3, 'en-US', 6)).toBe('12.30');
    expect(moneyText(1234.5678912, 'en-US', 6)).toBe('1,234.567891');
    expect(moneyText('abc', 'en-US', 6)).toBe('—');
  });
});
