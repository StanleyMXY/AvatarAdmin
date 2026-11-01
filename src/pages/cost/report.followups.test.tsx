import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { resetSessionState, setToken } from '../../request/session';
import { costTooltipItem } from './CostChart';
import ReportPage from './report';
import { chooseOption, holds, optionTexts } from './testSetup';

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const row = (currency: string, model = 'model-a') => ({
  statDate: '2026-10-25',
  resourceType: 'LLM',
  provider: 'p',
  model,
  unit: 'TOKENS_1M',
  source: 'CALL',
  tier: 'FREE',
  currency,
  requests: 10,
  inputTokens: 1000,
  cachedInputTokens: 400,
  outputTokens: 50,
  quantity: null,
  costAmount: '0.1',
  unpricedRequests: 0,
});

describe('the currency filter of the cost report', () => {
  it('still offers every currency that was seen after one of them was chosen, when the meta has no list', async () => {
    holds(['COST:VIEW'], {});
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/stats/usage-cost') {
        const only = u.searchParams.get('currency');
        const items = [row('USD'), row('EUR', 'model-b')].filter(
          (r) => !only || r.currency === only,
        );
        return jsonResponse(200, envelope('200', { items }));
      }
      if (u.pathname === '/api/admin/usage/models')
        return jsonResponse(200, envelope('200', { items: [], total: 0 }));
      return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
    });
    renderPage(<ReportPage />);
    await screen.findByTestId('cost-card-total');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await chooseOption(user, 'Currency', 'EUR');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getAllByTestId(/^cost-card-/).length).toBeGreaterThan(0));
    await waitFor(() => expect(document.body.textContent).not.toContain('model-a'));

    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    expect(optionTexts()).toEqual(['USD', 'EUR', 'No cost']);
  });
});

describe('the tooltip of the daily cost chart', () => {
  it('hands the chart the whole name of each model besides the short, numbered legend label', async () => {
    holds(['COST:VIEW'], { allowedCurrencies: ['USD'] });
    const long = `${'m'.repeat(30)}-first`;
    const other = `${'m'.repeat(30)}-second`;
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/stats/usage-cost')
        return jsonResponse(200, envelope('200', { items: [row('USD', long), row('USD', other)] }));
      return jsonResponse(200, envelope('200', { items: [], total: 0 }));
    });
    renderPage(<ReportPage />);
    await screen.findByTestId('cost-card-total');
    await waitFor(() =>
      expect(document.querySelector('[data-testid="chart-column"]')).not.toBeNull(),
    );
    const data = JSON.parse(
      (document.querySelector('[data-testid="chart-column"]') as HTMLElement).textContent ?? '[]',
    ) as { model: string; label: string }[];
    expect([...new Set(data.map((d) => d.model))].sort()).toEqual([long, other].sort());
    expect(new Set(data.map((d) => d.label)).size).toBe(2);
    expect(data.every((d) => d.label !== d.model)).toBe(true);
  });

  it('names the whole model and gives the exact amount, so that two names cut alike in the legend can be told apart', () => {
    const long = `${'m'.repeat(24)}-first`;
    const other = `${'m'.repeat(24)}-second`;
    expect(costTooltipItem({ model: long, text: '0.1234567890' })).toEqual({
      name: long,
      value: '0.1234567890',
    });
    expect(costTooltipItem({ model: other, text: '3' }).name).not.toBe(
      costTooltipItem({ model: long, text: '3' }).name,
    );
  });
});
