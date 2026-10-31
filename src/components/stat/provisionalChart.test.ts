import { describe, expect, it } from 'vitest';
import { hollowPointsMark, provisionalColumnStyle, provisionalPoints } from './provisionalChart';

const TODAY = '2026-10-26';

describe('provisionalPoints', () => {
  const rows = [
    { statDate: '2026-10-24', series: 'A', value: 1 },
    { statDate: '2026-10-25', series: 'A', value: 2 },
    { statDate: TODAY, series: 'A', value: 3 },
    { statDate: TODAY, series: 'B', value: null },
  ];
  it('keeps only the provisional rows that have a value: a gap is not drawn as a point', () => {
    expect(provisionalPoints(rows, TODAY)).toEqual([rows[2]]);
  });
  it('is empty when the range ends before today', () => {
    expect(provisionalPoints(rows.slice(0, 2), TODAY)).toEqual([]);
  });
});

describe('hollowPointsMark', () => {
  it('is a point mark with a hollow shape, filled with the background, over the given rows', () => {
    const rows = [{ statDate: TODAY, series: 'A', value: 3 }];
    expect(hollowPointsMark(rows, '#123456')).toMatchObject({
      type: 'point',
      data: rows,
      shapeField: 'hollowCircle',
      colorField: 'series',
      style: { fill: '#123456' },
    });
  });
});

describe('provisionalColumnStyle', () => {
  const style = provisionalColumnStyle('#abcdef');
  it('makes a column of a day that is not over paler, with a dashed border', () => {
    const column = { statDate: TODAY, provisional: true };
    expect(style.fillOpacity(column)).toBeLessThan(1);
    expect(style.lineWidth(column)).toBeGreaterThan(0);
    expect(style.lineDash(column)).toEqual([4, 4]);
    expect(style.stroke).toBe('#abcdef');
  });
  it('leaves a column of a day that is over as it was: full colour, no border, no dash', () => {
    for (const column of [{ provisional: false }, {}, null, undefined]) {
      expect(style.fillOpacity(column)).toBe(1);
      expect(style.lineWidth(column)).toBe(0);
      expect(style.lineDash(column)).toEqual([]);
    }
  });
});
