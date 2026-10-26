import {
  compareDecimals,
  formatAmount,
  RESOURCE_TYPES,
  sumDecimals,
  toDecimalString,
} from '../../services/cost';
import type { UsageCostRow } from '../../services/stats/types';
import { plainText } from '../../utils/plainText';

/** The currency the backend gives to requests that have no cost (contract 14.2): they only count as requests. */
export const NO_COST = 'NONE';

/** A report row as the page uses it: the cost and the quantity are decimal text, counts are never negative. */
export type CostLine = {
  statDate: string;
  resourceType: string;
  model: string;
  unit: string;
  source: string;
  tier: string;
  currency: string;
  requests: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  /** Only the types that are not LLM have a quantity. */
  quantity: string | null;
  /** Null when the requests had no price; never negative; always null in the no-cost currency. */
  cost: string | null;
  unpriced: number;
};

/** Text from the backend whose type the contract fixes but the page does not trust: written out, never thrown as a React child. */
const str = (value: unknown): string => plainText(value);

/** A count: a number that is not negative, else null. */
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Decimal text that is not negative, else null. */
function nonNegative(value: unknown): string | null {
  const text = toDecimalString(value);
  return text !== null && compareDecimals(text, '0') >= 0 ? text : null;
}

export function toLine(row: UsageCostRow): CostLine {
  const raw = row as unknown as Record<string, unknown>;
  const currency = str(raw.currency) === '' ? NO_COST : str(raw.currency);
  const llm = str(raw.resourceType) === 'LLM';
  return {
    statDate: str(raw.statDate),
    resourceType: str(raw.resourceType),
    model: str(raw.model),
    unit: str(raw.unit),
    source: str(raw.source),
    tier: str(raw.tier),
    currency,
    requests: count(raw.requests) ?? 0,
    inputTokens: llm ? count(raw.inputTokens) : null,
    cachedInputTokens: llm ? count(raw.cachedInputTokens) : null,
    outputTokens: llm ? count(raw.outputTokens) : null,
    quantity: llm ? null : nonNegative(raw.quantity),
    cost: currency === NO_COST ? null : nonNegative(raw.costAmount),
    unpriced: count(raw.unpricedRequests) ?? 0,
  };
}

const sumCounts = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
};

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Summary = {
  requests: number;
  /** Requests that had no price: they are counted, they have no cost. */
  unpriced: number;
  /** One amount for each currency that had a cost, never added to another currency. */
  totals: { currency: string; amount: string }[];
};

export function summarize(lines: CostLine[]): Summary {
  const perCurrency = new Map<string, (string | null)[]>();
  for (const line of lines) {
    if (line.currency === NO_COST) continue;
    const list = perCurrency.get(line.currency) ?? [];
    list.push(line.cost);
    perCurrency.set(line.currency, list);
  }
  const totals = [...perCurrency.entries()]
    .map(([currency, costs]) => ({ currency, amount: sumDecimals(costs) }))
    .filter((t): t is { currency: string; amount: string } => t.amount !== null)
    .sort((a, b) => byCode(a.currency, b.currency));
  return {
    requests: lines.reduce((sum, l) => sum + l.requests, 0),
    unpriced: lines.reduce((sum, l) => sum + l.unpriced, 0),
    totals,
  };
}

export type CostGroup = {
  key: string;
  resourceType: string;
  model: string;
  unit: string;
  source: string;
  tier: string;
  currency: string;
  requests: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  quantity: string | null;
  cost: string | null;
  unpriced: number;
};

const typeOrder = (type: string) => {
  const at = (RESOURCE_TYPES as readonly string[]).indexOf(type);
  return at === -1 ? RESOURCE_TYPES.length : at;
};

/** The rows of the table: the days added up for each resource type, model, source, tier, unit and currency. */
export function groupLines(lines: CostLine[]): CostGroup[] {
  const groups = new Map<string, CostLine[]>();
  for (const line of lines) {
    const key = [
      line.resourceType,
      line.model,
      line.source,
      line.tier,
      line.currency,
      line.unit,
    ].join('\u0000');
    const list = groups.get(key) ?? [];
    list.push(line);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      resourceType: list[0].resourceType,
      model: list[0].model,
      unit: list[0].unit,
      source: list[0].source,
      tier: list[0].tier,
      currency: list[0].currency,
      requests: list.reduce((sum, l) => sum + l.requests, 0),
      inputTokens: sumCounts(list.map((l) => l.inputTokens)),
      cachedInputTokens: sumCounts(list.map((l) => l.cachedInputTokens)),
      outputTokens: sumCounts(list.map((l) => l.outputTokens)),
      quantity: sumDecimals(list.map((l) => l.quantity)),
      cost: sumDecimals(list.map((l) => l.cost)),
      unpriced: list.reduce((sum, l) => sum + l.unpriced, 0),
    }))
    .sort(
      (a, b) =>
        typeOrder(a.resourceType) - typeOrder(b.resourceType) ||
        byCode(a.resourceType, b.resourceType) ||
        byCode(a.model, b.model) ||
        byCode(a.source, b.source) ||
        byCode(a.tier, b.tier) ||
        byCode(a.currency, b.currency),
    );
}

export type ChartPoint = {
  statDate: string;
  model: string;
  /** Only for drawing: the exact amount is `exact`, and `text` is what the tooltip shows. */
  value: number;
  exact: string;
  text: string;
};

/**
 * The daily cost for the chart, one chart for each currency that has a cost (the no-cost group has
 * none): a point for every day and every model, 0 where there was nothing. The amounts are added as
 * decimals; only the number handed to the drawing is a float, and the tooltip uses the text.
 */
export function chartSeries(
  lines: CostLine[],
  days: string[],
): { currency: string; points: ChartPoint[] }[] {
  const currencies = [...new Set(lines.filter((l) => l.cost !== null).map((l) => l.currency))].sort(
    byCode,
  );
  return currencies.map((currency) => {
    const mine = lines.filter((l) => l.currency === currency && l.cost !== null);
    const models = [...new Set(mine.map((l) => l.model))].sort(byCode);
    const points: ChartPoint[] = [];
    for (const statDate of days) {
      for (const model of models) {
        const sum = sumDecimals(
          mine.filter((l) => l.statDate === statDate && l.model === model).map((l) => l.cost),
        );
        const exact = sum ?? '0';
        points.push({
          statDate,
          model,
          value: Number(exact),
          exact,
          text: formatAmount(exact) ?? '0',
        });
      }
    }
    return { currency, points };
  });
}
