import { describe, expect, it } from 'vitest';
import { parseCostBatch } from './parseCostBatch';

const BOM = String.fromCharCode(0xfeff);
const csv = (...lines: string[]) => lines.join('\n');
const HEADER = 'campaign_code,stat_date,cost,currency,remark';
const asCsv = (text: string, limits?: Parameters<typeof parseCostBatch>[1]) =>
  parseCostBatch({ kind: 'csv', text }, limits);
const asJson = (text: string, limits?: Parameters<typeof parseCostBatch>[1]) =>
  parseCostBatch({ kind: 'json', text }, limits);

const row = (over: Record<string, unknown> = {}) => ({
  campaignCode: 'spring_us',
  statDate: '2026-10-20',
  amount: 12.5,
  currency: 'USD',
  remark: 'first',
  ...over,
});

describe('parseCostBatch: JSON', () => {
  it('reads an array of objects with the names of the request body', () => {
    const result = asJson(JSON.stringify([row(), row({ statDate: '2026-10-21', amount: 0 })]));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-20',
        amount: 12.5,
        currency: 'USD',
        remark: 'first',
      },
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-21',
        amount: 0,
        currency: 'USD',
        remark: 'first',
      },
    ]);
  });

  it('reads one object on each line, with or without a comma at the end of the line', () => {
    const text = [
      JSON.stringify(row()),
      '',
      `${JSON.stringify(row({ statDate: '2026-10-21' }))},`,
      JSON.stringify(row({ statDate: '2026-10-22' })),
    ].join('\n');
    const result = asJson(text);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.statDate)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('reads one single object and the names of the CSV header as well', () => {
    const result = asJson(
      '{"campaign_code":"spring_us","stat_date":"2026/10/20","cost":"3.10","currency":"usd"}',
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-20',
        amount: 3.1,
        currency: 'USD',
        remark: null,
      },
    ]);
  });

  it('turns the three ways of writing a day into YYYY-MM-DD', () => {
    const result = asJson(
      JSON.stringify([
        row({ statDate: '2026-10-20' }),
        row({ statDate: '2026/10/21' }),
        row({ statDate: '2026.10.22' }),
      ]),
    );
    expect(result.rows.map((r) => r.statDate)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('numbers inside text and numbers are the same amount', () => {
    const result = asJson(
      JSON.stringify([row({ amount: '7' }), row({ statDate: '2026-10-21', amount: 7.25 })]),
    );
    expect(result.rows.map((r) => r.amount)).toEqual([7, 7.25]);
  });

  it('says which line of the array and what is wrong, and gives no rows at all when one line is wrong', () => {
    const result = asJson(
      JSON.stringify([
        row(),
        row({ statDate: '2026-10-21', amount: -1 }),
        row({ statDate: '2026-10-22', amount: 'abc' }),
        row({ statDate: '2026-02-30' }),
        { campaignCode: 'spring_us', statDate: '2026-10-25' },
        row({ statDate: '2026-10-26', campaignCode: '' }),
      ]),
    );
    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => [e.line, e.reason])).toEqual([
      [2, 'AMOUNT_NEGATIVE'],
      [3, 'AMOUNT_NOT_NUMBER'],
      [4, 'DATE_INVALID'],
      [5, 'AMOUNT_MISSING'],
      [5, 'CURRENCY_MISSING'],
      [6, 'CODE_MISSING'],
    ]);
  });

  it('reports a line that is not JSON in the line form, and a text that is not JSON as a whole', () => {
    const lines = asJson(`${JSON.stringify(row())}\n{oops`);
    expect(lines.rows).toEqual([]);
    expect(lines.errors).toEqual([{ line: 2, reason: 'JSON_INVALID' }]);
    const whole = asJson('[{"a":1}, nonsense]');
    expect(whole.rows).toEqual([]);
    expect(whole.errors.map((e) => e.reason)).toContain('JSON_INVALID');
  });

  it('refuses an element that is not an object, a number as the whole text, and empty text', () => {
    expect(asJson('[1, "x"]').errors.map((e) => [e.line, e.reason])).toEqual([
      [1, 'ROW_NOT_OBJECT'],
      [2, 'ROW_NOT_OBJECT'],
    ]);
    expect(asJson('42').errors.map((e) => e.reason)).toEqual(['JSON_INVALID']);
    expect(asJson('   \n ').errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
    expect(asJson('[]').errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
  });

  it('refuses a remark that is not text', () => {
    expect(asJson(JSON.stringify([row({ remark: 5 })])).errors.map((e) => e.reason)).toEqual([
      'REMARK_NOT_TEXT',
    ]);
    expect(asJson(JSON.stringify([row({ remark: null })])).rows[0].remark).toBeNull();
  });
});

describe('parseCostBatch: CSV', () => {
  it('reads the header of the template and the rows', () => {
    const result = asCsv(
      csv(HEADER, 'spring_us,2026-10-20,12.50,USD,first', 'spring_us,2026/10/21,0,USD,'),
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-20',
        amount: 12.5,
        currency: 'USD',
        remark: 'first',
      },
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-21',
        amount: 0,
        currency: 'USD',
        remark: null,
      },
    ]);
  });

  it('handles a byte order mark, CRLF, CR and a missing last line break', () => {
    const body = [HEADER, 'a_one,2026-10-20,1,USD,x', 'a_one,2026-10-21,2,USD,y'];
    for (const text of [`${BOM}${body.join('\r\n')}\r\n`, body.join('\r'), body.join('\n')]) {
      const result = asCsv(text);
      expect(result.errors).toEqual([]);
      expect(result.rows.map((r) => r.amount)).toEqual([1, 2]);
    }
  });

  it('keeps commas, quotes and line breaks inside a quoted remark', () => {
    const result = asCsv(
      csv(
        HEADER,
        'a_one,2026-10-20,1,USD,"red, ""big"" sale',
        'second line"',
        'a_one,2026-10-21,2,USD,plain',
      ),
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0].remark).toBe('red, "big" sale\nsecond line');
    expect(result.rows[1].remark).toBe('plain');
  });

  it('reads remarks in Thai, Arabic, Vietnamese, Indonesian, Spanish, English, Chinese, emoji and 5000 characters without a space', () => {
    const remarks = [
      'แคมเปญฤดูใบไม้ผลิ',
      'حملة الربيع، الخصم الكبير',
      'Chiến dịch mùa xuân',
      'Kampanye musim semi, diskon besar',
      'Campaña de primavera, ¡gran descuento!',
      'Spring sale',
      '春季活动，大折扣',
      'sale 🎉🚀',
      'x'.repeat(5000),
    ];
    const lines = remarks.map(
      (remark, i) =>
        `a_one,2026-10-${String(i + 1).padStart(2, '0')},1,USD,"${remark.replaceAll('"', '""')}"`,
    );
    const result = asCsv(csv(HEADER, ...lines));
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.remark)).toEqual(remarks);
  });

  it('accepts the columns in any order and without the remark column, ignoring case and spaces', () => {
    const result = asCsv(csv(' Currency , COST,stat_date,campaign_code', 'usd,3,2026.10.20,a_one'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { campaignCode: 'a_one', statDate: '2026-10-20', amount: 3, currency: 'USD', remark: null },
    ]);
  });

  it('skips blank lines but counts them in the line numbers', () => {
    const result = asCsv(csv(HEADER, '', 'a_one,2026-10-20,-3,USD,x'));
    expect(result.errors).toEqual([{ line: 3, reason: 'AMOUNT_NEGATIVE' }]);
  });

  it('reports each bad row with its line in the file, the header being line 1, and gives no rows', () => {
    const result = asCsv(
      csv(
        HEADER,
        'a_one,2026-10-20,1,USD,ok',
        'a_one,2026-10-21,-5,USD,negative',
        'a_one,2026-10-22,abc,USD,not a number',
        'a_one,2026-02-30,1,USD,no such day',
        'a_one,20261023,1,USD,not a day',
        'A One,2026-10-24,1,USD,bad code',
        'a_one,2026-10-25,1.234,USD,three decimals',
        'a_one,2026-10-26,,USD,no amount',
        'a_one,2026-10-27,1,,no currency',
        'a_one,2026-10-28,1',
      ),
    );
    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => [e.line, e.reason])).toEqual([
      [3, 'AMOUNT_NEGATIVE'],
      [4, 'AMOUNT_NOT_NUMBER'],
      [5, 'DATE_INVALID'],
      [6, 'DATE_FORMAT'],
      [7, 'CODE_INVALID'],
      [8, 'AMOUNT_DECIMALS'],
      [9, 'AMOUNT_MISSING'],
      [10, 'CURRENCY_MISSING'],
      [11, 'COLUMN_COUNT'],
    ]);
  });

  it('numbers the line of a row after a remark that spans two lines by where the row starts', () => {
    const result = asCsv(
      csv(HEADER, 'a_one,2026-10-20,1,USD,"two', 'lines"', 'a_one,2026-10-21,-1,USD,x'),
    );
    expect(result.errors).toEqual([{ line: 4, reason: 'AMOUNT_NEGATIVE' }]);
  });

  it('refuses a header without a needed column or with a column it does not know', () => {
    expect(asCsv('campaign_code,stat_date,currency\na_one,2026-10-20,USD').errors).toEqual([
      { line: 1, reason: 'HEADER_MISSING', values: { column: 'cost' } },
    ]);
    expect(asCsv(`${HEADER},extra\na_one,2026-10-20,1,USD,x,y`).errors).toEqual([
      { line: 1, reason: 'HEADER_UNKNOWN', values: { column: 'extra' } },
    ]);
    expect(asCsv(`${HEADER},cost\na`).errors[0]).toEqual({
      line: 1,
      reason: 'HEADER_DUPLICATE',
      values: { column: 'cost' },
    });
  });

  it('refuses a quote that is never closed, and a file with only the header', () => {
    expect(asCsv(csv(HEADER, 'a_one,2026-10-20,1,USD,"open')).errors).toEqual([
      { line: 2, reason: 'CSV_QUOTE' },
    ]);
    expect(asCsv(HEADER).errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
    expect(asCsv('').errors).toEqual([{ line: 0, reason: 'EMPTY' }]);
  });
});

describe('parseCostBatch: the amount', () => {
  const amounts = (...values: string[]) =>
    asCsv(
      csv(
        HEADER,
        ...values.map((v, i) => `a_one,2026-10-${String(i + 1).padStart(2, '0')},${v},USD,`),
      ),
    );

  it('takes zero, whole numbers and one or two decimals', () => {
    expect(amounts('0', '5', '5.5', '5.55', '0.00').rows.map((r) => r.amount)).toEqual([
      0, 5, 5.5, 5.55, 0,
    ]);
  });

  it('refuses a minus sign, a plus sign, an exponent, a comma, spaces inside and a number too large to keep exactly', () => {
    const result = amounts('-0.00', '+3', '1e3', '1,5', '1 5', '12345678901234');
    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => e.reason)).toEqual([
      'AMOUNT_NEGATIVE',
      'AMOUNT_NOT_NUMBER',
      'AMOUNT_NOT_NUMBER',
      'COLUMN_COUNT',
      'AMOUNT_NOT_NUMBER',
      'AMOUNT_TOO_LARGE',
    ]);
  });
});

describe('parseCostBatch: the limits of the batch', () => {
  const lines = (n: number) =>
    csv(
      HEADER,
      ...Array.from(
        { length: n },
        (_, i) => `a_one,${new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)},1,USD,`,
      ),
    );

  it('takes exactly attribution.cost_batch_max rows and refuses one more, with no rows', () => {
    expect(asCsv(lines(3), { maxRows: 3 }).rows).toHaveLength(3);
    const over = asCsv(lines(4), { maxRows: 3 });
    expect(over.rows).toEqual([]);
    expect(over.errors).toEqual([
      { line: 0, reason: 'TOO_MANY_ROWS', values: { max: 3, count: 4 } },
    ]);
    const json = asJson(
      JSON.stringify(Array.from({ length: 4 }, (_, i) => row({ statDate: `2026-10-0${i + 1}` }))),
      { maxRows: 3 },
    );
    expect(json.errors).toEqual([
      { line: 0, reason: 'TOO_MANY_ROWS', values: { max: 3, count: 4 } },
    ]);
  });

  it('does not limit the rows when the limit is not known', () => {
    expect(asCsv(lines(50)).rows).toHaveLength(50);
    expect(asCsv(lines(50), { maxRows: null }).rows).toHaveLength(50);
  });

  it('refuses a row whose currency is not attribution.cost_currency, comparing without regard to case', () => {
    const text = csv(HEADER, 'a_one,2026-10-20,1,usd,', 'a_one,2026-10-21,1,EUR,');
    const result = asCsv(text, { currency: 'USD' });
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 3, reason: 'CURRENCY_MISMATCH', values: { expected: 'USD', found: 'EUR' } },
    ]);
    expect(
      asCsv(csv(HEADER, 'a_one,2026-10-20,1,usd,'), { currency: 'USD' }).rows[0].currency,
    ).toBe('USD');
    // the currency is not known: the backend decides
    expect(asCsv(text).errors).toEqual([]);
  });

  it('refuses the same campaign and day twice in one batch, on each later row, and no rows', () => {
    const text = csv(
      HEADER,
      'a_one,2026-10-20,1,USD,',
      'b_two,2026-10-20,1,USD,',
      'a_one,2026/10/20,2,USD,',
      'a_one,2026.10.20,3,USD,',
    );
    const result = asCsv(text);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 4, reason: 'DUPLICATE_IN_BATCH', values: { first: 2 } },
      { line: 5, reason: 'DUPLICATE_IN_BATCH', values: { first: 2 } },
    ]);
  });

  it('does not take the same day of two campaigns, or two days of one campaign, for a repeat', () => {
    const text = csv(
      HEADER,
      'a_one,2026-10-20,1,USD,',
      'b_two,2026-10-20,1,USD,',
      'a_one,2026-10-21,1,USD,',
    );
    expect(asCsv(text).errors).toEqual([]);
  });

  it('keeps the other errors of a row that is also a repeat, and reports a bad row only once', () => {
    const text = csv(HEADER, 'a_one,2026-10-20,1,USD,', 'a_one,2026-10-20,-1,USD,');
    expect(asCsv(text).errors.map((e) => [e.line, e.reason])).toEqual([[3, 'AMOUNT_NEGATIVE']]);
  });
});
