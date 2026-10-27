import { describe, expect, it } from 'vitest';
import type { UsageCostRow } from '../../services/stats/types';
import { chartSeries, groupLines, NO_COST, summarize, toLine } from './costRows';

const row = (over: Partial<Record<keyof UsageCostRow, unknown>> = {}): UsageCostRow =>
  ({
    statDate: '2026-10-25',
    resourceType: 'LLM',
    provider: 'p',
    model: 'm',
    unit: 'TOKENS_1M',
    source: 'CALL',
    tier: 'FREE',
    currency: 'USD',
    requests: 10,
    inputTokens: 1000,
    cachedInputTokens: 400,
    outputTokens: 50,
    quantity: null,
    costAmount: '0.1',
    unpricedRequests: 0,
    ...over,
  }) as UsageCostRow;

describe('toLine: one report row as the page uses it', () => {
  it('keeps the cost as decimal text, whatever the backend sent', () => {
    expect(toLine(row({ costAmount: '0.0000000001' })).cost).toBe('0.0000000001');
    expect(toLine(row({ costAmount: 0.0000001 })).cost).toBe('0.0000001');
    expect(toLine(row({ costAmount: 1e-10 })).cost).toBe('0.0000000001');
    expect(toLine(row({ costAmount: '12345678.1234567890' })).cost).toBe('12345678.1234567890');
  });

  it('a cost that is missing, not a number or negative is no cost; zero stays 0', () => {
    expect(toLine(row({ costAmount: null })).cost).toBeNull();
    expect(toLine(row({ costAmount: 'abc' })).cost).toBeNull();
    expect(toLine(row({ costAmount: '-0.5' })).cost).toBeNull();
    expect(toLine(row({ costAmount: -1 })).cost).toBeNull();
    expect(toLine(row({ costAmount: '0' })).cost).toBe('0');
    expect(toLine(row({ costAmount: 0 })).cost).toBe('0');
  });

  it('the no-cost currency never carries an amount, and an empty currency is the no-cost group', () => {
    expect(toLine(row({ currency: NO_COST, costAmount: '5' })).cost).toBeNull();
    expect(toLine(row({ currency: '' })).currency).toBe(NO_COST);
    expect(toLine(row({ currency: null })).currency).toBe(NO_COST);
  });

  it('counts are never negative or not-numbers: they become null', () => {
    const line = toLine(
      row({
        requests: -3,
        inputTokens: -1,
        cachedInputTokens: Number.NaN,
        outputTokens: '7',
        unpricedRequests: -2,
      }),
    );
    expect(line.requests).toBe(0);
    expect(line.inputTokens).toBeNull();
    expect(line.cachedInputTokens).toBeNull();
    expect(line.outputTokens).toBeNull();
    expect(line.unpriced).toBe(0);
  });

  it('tokens belong to LLM only and quantity to the other types', () => {
    const other = toLine(
      row({
        resourceType: 'IMAGE_TO_VIDEO',
        unit: 'SECOND',
        inputTokens: 5,
        outputTokens: 6,
        quantity: 2.5,
      }),
    );
    expect(other.inputTokens).toBeNull();
    expect(other.outputTokens).toBeNull();
    expect(other.quantity).toBe('2.5');
    const llm = toLine(row({ quantity: 9 }));
    expect(llm.quantity).toBeNull();
    expect(llm.inputTokens).toBe(1000);
  });
});

describe('summarize: the cards', () => {
  it('adds the cost of each currency apart and never one currency to another', () => {
    const lines = [
      toLine(row({ currency: 'USD', costAmount: '1.10' })),
      toLine(row({ currency: 'EUR', costAmount: '2.20' })),
      toLine(row({ currency: 'USD', costAmount: '0.20' })),
    ];
    expect(summarize(lines).totals).toEqual([
      { currency: 'EUR', amount: '2.20' },
      { currency: 'USD', amount: '1.30' },
    ]);
  });

  it('adds exactly: three times 0.1 is 0.3', () => {
    const lines = ['0.1', '0.1', '0.1'].map((c) => toLine(row({ costAmount: c })));
    expect(summarize(lines).totals).toEqual([{ currency: 'USD', amount: '0.3' }]);
  });

  it('adds ten thousand tiny amounts without losing a digit', () => {
    const lines = Array.from({ length: 10000 }, () => toLine(row({ costAmount: '0.0000000001' })));
    expect(summarize(lines).totals[0].amount).toBe('0.0000010000');
  });

  it('counts the requests of every group, the no-cost one included, and the requests without a price', () => {
    const lines = [
      toLine(row({ requests: 10 })),
      toLine(row({ currency: NO_COST, costAmount: null, requests: 5, unpricedRequests: 5 })),
      toLine(row({ requests: 1, unpricedRequests: 2 })),
    ];
    const s = summarize(lines);
    expect(s.requests).toBe(16);
    expect(s.unpriced).toBe(7);
  });

  it('has no total for a currency whose rows have no cost, and none at all for the no-cost group', () => {
    const lines = [
      toLine(row({ currency: NO_COST, costAmount: null, requests: 5, unpricedRequests: 5 })),
    ];
    expect(summarize(lines).totals).toEqual([]);
  });

  it('a total of zero is kept as 0 (not hidden)', () => {
    expect(summarize([toLine(row({ costAmount: '0' }))]).totals).toEqual([
      { currency: 'USD', amount: '0' },
    ]);
  });

  it('nothing in, nothing out', () => {
    expect(summarize([])).toEqual({ requests: 0, unpriced: 0, totals: [] });
  });
});

describe('groupLines: the table', () => {
  it('adds the days of one resource type, model, source, tier and currency into one row', () => {
    const lines = [
      toLine(
        row({
          statDate: '2026-10-24',
          requests: 10,
          inputTokens: 100,
          cachedInputTokens: 10,
          outputTokens: 5,
          costAmount: '0.1',
        }),
      ),
      toLine(
        row({
          statDate: '2026-10-25',
          requests: 20,
          inputTokens: 200,
          cachedInputTokens: 20,
          outputTokens: 7,
          costAmount: '0.2',
        }),
      ),
    ];
    const groups = groupLines(lines);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      requests: 30,
      inputTokens: 300,
      cachedInputTokens: 30,
      outputTokens: 12,
      cost: '0.3',
      quantity: null,
    });
  });

  it('keeps the currencies in separate rows, and the no-cost requests in a row of their own', () => {
    const lines = [
      toLine(row({ currency: 'USD' })),
      toLine(row({ currency: 'EUR' })),
      toLine(row({ currency: NO_COST, costAmount: null, unpricedRequests: 10 })),
    ];
    const groups = groupLines(lines);
    expect(groups.map((g) => g.currency).sort()).toEqual(['EUR', NO_COST, 'USD']);
    expect(groups.find((g) => g.currency === NO_COST)?.cost).toBeNull();
    expect(groups.find((g) => g.currency === NO_COST)?.unpriced).toBe(10);
  });

  it('separates the source and the tier', () => {
    const lines = [
      toLine(row({ source: 'CALL' })),
      toLine(row({ source: 'TEXT' })),
      toLine(row({ tier: 'GUEST' })),
    ];
    expect(groupLines(lines)).toHaveLength(3);
  });

  it('adds the quantity of a type that is not LLM exactly, with its unit', () => {
    const lines = ['0.1', '0.2'].map((q) =>
      toLine(
        row({
          resourceType: 'IMAGE_TO_VIDEO',
          unit: 'SECOND',
          quantity: Number(q),
          costAmount: '1',
        }),
      ),
    );
    const [g] = groupLines(lines);
    expect(g.quantity).toBe('0.3');
    expect(g.unit).toBe('SECOND');
    expect(g.inputTokens).toBeNull();
  });

  it('leaves a token or quantity column empty (null) when no row had a value, but a real 0 stays 0', () => {
    const [none] = groupLines([
      toLine(row({ inputTokens: null, cachedInputTokens: null, outputTokens: null })),
    ]);
    expect(none.inputTokens).toBeNull();
    const [zero] = groupLines([
      toLine(row({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costAmount: '0' })),
    ]);
    expect(zero.inputTokens).toBe(0);
    expect(zero.cost).toBe('0');
  });

  it('orders by resource type (LLM first), then model', () => {
    const lines = [
      toLine(row({ resourceType: 'CLOUD_RENDER', unit: 'MINUTE', model: 'a', quantity: 1 })),
      toLine(row({ resourceType: 'LLM', model: 'z' })),
      toLine(row({ resourceType: 'LLM', model: 'b' })),
      toLine(row({ resourceType: 'SOMETHING_NEW', model: 'a' })),
    ];
    expect(groupLines(lines).map((g) => `${g.resourceType}/${g.model}`)).toEqual([
      'LLM/b',
      'LLM/z',
      'CLOUD_RENDER/a',
      'SOMETHING_NEW/a',
    ]);
  });

  it('keeps model names of every language and of any length as they are', () => {
    const names = [
      'โมเดลภาษาไทย',
      'نموذج-كبير',
      'modelo-grande',
      'mô-hình',
      'model-besar',
      '模型',
      'x'.repeat(5000),
      'emoji-😀',
    ];
    const groups = groupLines(names.map((model) => toLine(row({ model }))));
    expect(groups.map((g) => g.model).sort()).toEqual([...names].sort());
  });
});

describe('chartSeries: the daily cost by model, one chart for each currency', () => {
  const days = ['2026-10-24', '2026-10-25', '2026-10-26'];

  it('has one chart per currency with a cost, none for the no-cost group', () => {
    const lines = [
      toLine(row({ currency: 'USD', costAmount: '1' })),
      toLine(row({ currency: 'EUR', costAmount: '2' })),
      toLine(row({ currency: NO_COST, costAmount: null })),
    ];
    expect(chartSeries(lines, days).map((c) => c.currency)).toEqual(['EUR', 'USD']);
  });

  it('has a point for every day and every model, 0 where there was no cost that day, and adds models of the same name in a day', () => {
    const lines = [
      toLine(row({ statDate: '2026-10-25', model: 'a', costAmount: '0.1' })),
      toLine(row({ statDate: '2026-10-25', model: 'a', source: 'TEXT', costAmount: '0.2' })),
      toLine(row({ statDate: '2026-10-26', model: 'b', costAmount: '5' })),
    ];
    const [chart] = chartSeries(lines, days);
    expect(chart.points).toHaveLength(6);
    const at = (statDate: string, model: string) =>
      chart.points.find((p) => p.statDate === statDate && p.model === model);
    expect(at('2026-10-25', 'a')).toMatchObject({ value: 0.3, text: '0.30' });
    expect(at('2026-10-24', 'a')).toMatchObject({ value: 0, text: '0' });
    expect(at('2026-10-26', 'b')).toMatchObject({ value: 5, text: '5.00' });
  });

  it('shows the exact amount in the tooltip text even where the plotted number is a float', () => {
    const [chart] = chartSeries(
      [toLine(row({ statDate: '2026-10-25', costAmount: '0.0000000001' }))],
      days,
    );
    expect(chart.points.find((p) => p.statDate === '2026-10-25')?.text).toBe('<0.000001');
    expect(chart.points.find((p) => p.statDate === '2026-10-25')?.exact).toBe('0.0000000001');
  });

  it('is empty when there is no cost at all', () => {
    expect(chartSeries([], days)).toEqual([]);
  });
});
