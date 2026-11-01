import { describe, expect, it } from 'vitest';
import { parseCostBatch } from './parseCostBatch';

// Built from a code point, so that no invisible character sits in the source.
const BOM = String.fromCharCode(0xfeff);
const asCsv = (text: string) => parseCostBatch({ kind: 'csv', text });
const HEADER = 'campaign_code,stat_date,cost,currency,remark';

describe('parseCostBatch: a CSV of one line', () => {
  it('says the header is missing when the one line is a row of data, not that the file is empty', () => {
    const { rows, errors } = asCsv('spring_th,2026-10-01,12.30,USD,first day');
    expect(rows).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.reason === 'EMPTY')).toBe(false);
    expect(
      errors.filter((e) => e.reason === 'HEADER_MISSING').map((e) => e.values?.column),
    ).toEqual(['campaign_code', 'stat_date', 'cost', 'currency']);
    expect(errors.every((e) => e.line === 1)).toBe(true);
  });

  it('still says the file is empty when the one line is a good header and nothing follows', () => {
    expect(asCsv(HEADER).errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
    expect(asCsv(`${HEADER}\n`).errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
    expect(asCsv(`${BOM}${HEADER}\r\n`).errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
  });

  it('says the file is empty when there is nothing at all', () => {
    expect(asCsv('').errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
  });

  it('names a column it does not know when the one line has other names', () => {
    const { errors } = asCsv('code,day,price');
    expect(
      errors.filter((e) => e.reason === 'HEADER_UNKNOWN').map((e) => e.values?.column),
    ).toEqual(['code', 'day', 'price']);
  });
});
