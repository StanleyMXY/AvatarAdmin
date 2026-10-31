import { isProvisionalDay } from '../../utils/settledDay';

/**
 * How the charts show a value that is still being counted: a hollow point instead of a solid one
 * (a column gets a dashed border). The day rule is `utils/settledDay.ts`.
 */
export const HOLLOW_MARKER = 'hollowCircle';
export const SOLID_MARKER = 'circle';

/** The rows to draw as hollow points: provisional days that have a value (a gap has no point). */
export function provisionalPoints<T extends { statDate: string; value: number | null }>(
  rows: readonly T[],
  today: string,
  lagDays = 0,
): T[] {
  return rows.filter((row) => row.value !== null && isProvisionalDay(row.statDate, today, lagDays));
}

/**
 * The mark of the hollow points, to give a line chart as an `annotations` entry (it shares the
 * scales of the chart, so the points sit on the line). The fill is the page background, so the line
 * and a solid marker below do not show through.
 */
export const hollowPointsMark = <T extends { statDate: string; value: number | null }>(
  rows: readonly T[],
  background: string,
) => ({
  type: 'point',
  data: [...rows],
  xField: 'statDate',
  yField: 'value',
  colorField: 'series',
  shapeField: HOLLOW_MARKER,
  sizeField: 5,
  style: { fill: background, lineWidth: 2 },
});

const isMarked = (d: unknown): boolean =>
  (d as { provisional?: boolean } | null)?.provisional === true;

/**
 * The style of the stacked columns of a chart whose rows carry `provisional`: a column of a day
 * that is not over is paler and has a dashed border, the others are as they were.
 */
export const provisionalColumnStyle = (borderColor: string) => ({
  fillOpacity: (d: unknown) => (isMarked(d) ? 0.45 : 1),
  stroke: borderColor,
  lineWidth: (d: unknown) => (isMarked(d) ? 1.5 : 0),
  lineDash: (d: unknown) => (isMarked(d) ? [4, 4] : []),
});
