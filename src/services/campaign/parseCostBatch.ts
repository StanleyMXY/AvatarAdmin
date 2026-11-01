import { trimSpec } from '../../utils/trimSpec';

// The batch entry of campaign costs (spec 5.13, contract 10.5) is read in the browser: nothing here
// touches the network. The rules are the contract's: a whole batch is refused when one row is bad,
// every bad row is named with its line, the days are written in one of three ways, the currency is
// the one currency of the system, and the same (campaign, day) cannot come twice.

/** One row of `POST /attribution/costs/batch`. */
export type CostRow = {
  campaignCode: string;
  /** `YYYY-MM-DD`, a UTC day. */
  statDate: string;
  /** Not below 0, at most two decimals. */
  amount: number;
  currency: string;
  remark: string | null;
};

export type CostBatchInput = { kind: 'json'; text: string } | { kind: 'csv'; text: string };

/** What the page knows from `GET /config`. A limit that is not known is not checked here; the backend decides. */
export type CostBatchLimits = {
  /** `attribution.cost_batch_max`. */
  maxRows?: number | null;
  /** `attribution.cost_currency`. */
  currency?: string | null;
};

export const BATCH_REASONS = [
  'EMPTY',
  'TOO_MANY_ROWS',
  'JSON_INVALID',
  'ROW_NOT_OBJECT',
  'CSV_QUOTE',
  'HEADER_MISSING',
  'HEADER_UNKNOWN',
  'HEADER_DUPLICATE',
  'COLUMN_COUNT',
  'CODE_MISSING',
  'CODE_INVALID',
  'DATE_MISSING',
  'DATE_FORMAT',
  'DATE_INVALID',
  'AMOUNT_MISSING',
  'AMOUNT_NOT_NUMBER',
  'AMOUNT_NEGATIVE',
  'AMOUNT_DECIMALS',
  'AMOUNT_TOO_LARGE',
  'CURRENCY_MISSING',
  'CURRENCY_MISMATCH',
  'REMARK_NOT_TEXT',
  'DUPLICATE_IN_BATCH',
] as const;
export type BatchReason = (typeof BATCH_REASONS)[number];

/**
 * `line` is the line in the text the person gave (the header of a CSV is line 1; for a JSON array
 * it is the place in the array, counted from 1); 0 is the whole text. `reason` is a code, the page
 * has a text for each; `values` fill the blanks of that text.
 */
export type BatchError = {
  line: number;
  reason: BatchReason;
  values?: Record<string, string | number>;
};

export type CostBatchResult = { rows: CostRow[]; errors: BatchError[] };

/** The amount is kept exactly in a JSON number as long as its whole part has at most this many digits. */
const MAX_INTEGER_DIGITS = 13;
const CODE = /^[a-z0-9_-]{3,32}$/;
const DAY = /^(\d{4})([-/.])(\d{2})\2(\d{2})$/;
const AMOUNT = /^(-)?(\d+)(?:\.(\d+))?$/;

const CSV_COLUMNS = ['campaign_code', 'stat_date', 'cost', 'currency', 'remark'] as const;
const REQUIRED_COLUMNS = ['campaign_code', 'stat_date', 'cost', 'currency'] as const;
type Column = (typeof CSV_COLUMNS)[number];

/** The values of one row as they were written, before any check. */
type Fields = Partial<Record<Column, unknown>>;
type Raw = { line: number; fields: Fields } | { line: number; error: BatchError['reason'] };

const BYTE_ORDER_MARK = 0xfeff;
const withoutMark = (text: string) =>
  text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;

const absent = (value: unknown) => value === undefined || value === null;

function isRealDay(year: number, month: number, day: number): boolean {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** The first thing wrong with a day, or the day written `YYYY-MM-DD`. */
function readDay(value: unknown): { day: string } | { reason: BatchReason } {
  if (absent(value)) return { reason: 'DATE_MISSING' };
  const text = typeof value === 'string' ? trimSpec(value) : '';
  if (typeof value === 'string' && text === '') return { reason: 'DATE_MISSING' };
  const match = DAY.exec(text);
  if (!match) return { reason: 'DATE_FORMAT' };
  const [year, month, day] = [Number(match[1]), Number(match[3]), Number(match[4])];
  if (!isRealDay(year, month, day)) return { reason: 'DATE_INVALID' };
  return { day: `${match[1]}-${match[3]}-${match[4]}` };
}

function readAmount(value: unknown): { amount: number } | { reason: BatchReason } {
  if (absent(value)) return { reason: 'AMOUNT_MISSING' };
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { reason: 'AMOUNT_NOT_NUMBER' };
    text = String(value);
  } else if (typeof value === 'string') {
    text = trimSpec(value);
  } else {
    return { reason: 'AMOUNT_NOT_NUMBER' };
  }
  if (text === '') return { reason: 'AMOUNT_MISSING' };
  const match = AMOUNT.exec(text);
  if (!match) return { reason: 'AMOUNT_NOT_NUMBER' };
  if (match[1]) return { reason: 'AMOUNT_NEGATIVE' };
  if ((match[3] ?? '').length > 2) return { reason: 'AMOUNT_DECIMALS' };
  if (match[2].replace(/^0+(?=\d)/, '').length > MAX_INTEGER_DIGITS) {
    return { reason: 'AMOUNT_TOO_LARGE' };
  }
  return { amount: Number(text) };
}

/** Checks the rows one by one and the batch as a whole. `rows` is empty unless every row is good. */
function finish(
  raws: Raw[],
  before: BatchError[],
  limits: CostBatchLimits | undefined,
): CostBatchResult {
  if (raws.length === 0 && before.length === 0) {
    return { rows: [], errors: [{ line: 0, reason: 'EMPTY' }] };
  }
  const max = limits?.maxRows;
  if (typeof max === 'number' && Number.isFinite(max) && raws.length > max) {
    return {
      rows: [],
      errors: [{ line: 0, reason: 'TOO_MANY_ROWS', values: { max, count: raws.length } }],
    };
  }
  const expected =
    typeof limits?.currency === 'string' && limits.currency !== ''
      ? limits.currency.toUpperCase()
      : null;
  const errors: BatchError[] = [...before];
  const rows: CostRow[] = [];
  const firstLine = new Map<string, number>();

  for (const raw of raws) {
    if ('error' in raw) {
      errors.push({ line: raw.line, reason: raw.error });
      continue;
    }
    const { line, fields } = raw;
    const problems: BatchError[] = [];
    const problem = (reason: BatchReason, values?: BatchError['values']) =>
      problems.push(values ? { line, reason, values } : { line, reason });

    // campaign code
    let code = '';
    if (absent(fields.campaign_code)) problem('CODE_MISSING');
    else if (typeof fields.campaign_code !== 'string') problem('CODE_INVALID');
    else {
      code = trimSpec(fields.campaign_code);
      if (code === '') problem('CODE_MISSING');
      else if (!CODE.test(code)) problem('CODE_INVALID');
    }
    // day
    const day = readDay(fields.stat_date);
    if ('reason' in day) problem(day.reason);
    // amount
    const amount = readAmount(fields.cost);
    if ('reason' in amount) problem(amount.reason);
    // currency
    let currency = '';
    if (
      absent(fields.currency) ||
      (typeof fields.currency === 'string' && trimSpec(fields.currency) === '')
    ) {
      problem('CURRENCY_MISSING');
    } else if (typeof fields.currency !== 'string') {
      problem('CURRENCY_MISSING');
    } else {
      currency = trimSpec(fields.currency).toUpperCase();
      if (expected !== null && currency !== expected) {
        problem('CURRENCY_MISMATCH', { expected, found: currency });
      }
    }
    // remark
    let remark: string | null = null;
    if (!absent(fields.remark)) {
      if (typeof fields.remark !== 'string') problem('REMARK_NOT_TEXT');
      else remark = trimSpec(fields.remark) === '' ? null : trimSpec(fields.remark);
    }

    if (problems.length > 0) {
      errors.push(...problems);
      continue;
    }
    if (!('day' in day) || !('amount' in amount)) continue;
    const key = `${code}|${day.day}`;
    const first = firstLine.get(key);
    if (first !== undefined) {
      errors.push({ line, reason: 'DUPLICATE_IN_BATCH', values: { first } });
      continue;
    }
    firstLine.set(key, line);
    rows.push({ campaignCode: code, statDate: day.day, amount: amount.amount, currency, remark });
  }

  // The lines in order; the problems of the whole text (line 0) come first. The sort is stable.
  errors.sort((a, b) => a.line - b.line);
  return errors.length > 0 ? { rows: [], errors } : { rows, errors };
}

// ---- JSON ----

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Takes the names of the request body and the names of the CSV header; the request body names win. */
function fieldsOfObject(object: Record<string, unknown>): Fields {
  const pick = (...names: string[]) => names.map((n) => object[n]).find((v) => v !== undefined);
  return {
    campaign_code: pick('campaignCode', 'campaign_code'),
    stat_date: pick('statDate', 'stat_date'),
    cost: pick('amount', 'cost'),
    currency: pick('currency'),
    remark: pick('remark'),
  };
}

const jsonRow = (value: unknown, line: number): Raw =>
  isObject(value) ? { line, fields: fieldsOfObject(value) } : { line, error: 'ROW_NOT_OBJECT' };

function readJson(text: string, limits: CostBatchLimits | undefined): CostBatchResult {
  const whole = trimSpec(withoutMark(text));
  if (whole === '') return finish([], [], limits);
  let value: unknown;
  let parsed = true;
  try {
    value = JSON.parse(whole);
  } catch {
    parsed = false;
  }
  if (parsed) {
    if (Array.isArray(value)) {
      return finish(
        value.map((element, index) => jsonRow(element, index + 1)),
        [],
        limits,
      );
    }
    if (isObject(value)) return finish([jsonRow(value, 1)], [], limits);
    return { rows: [], errors: [{ line: 0, reason: 'JSON_INVALID' }] };
  }
  // An array that is not valid is one mistake, not one for every line of it.
  if (whole.startsWith('[')) return { rows: [], errors: [{ line: 0, reason: 'JSON_INVALID' }] };

  // One object on each line, a comma at the end of a line allowed.
  const raws: Raw[] = [];
  const before: BatchError[] = [];
  whole.split(/\r\n|\r|\n/).forEach((source, index) => {
    const line = index + 1;
    let one = trimSpec(source);
    if (one === '') return;
    if (one.endsWith(',')) one = trimSpec(one.slice(0, -1));
    try {
      raws.push(jsonRow(JSON.parse(one), line));
    } catch {
      before.push({ line, reason: 'JSON_INVALID' });
    }
  });
  return finish(raws, before, limits);
}

// ---- CSV ----

type CsvRecord = { line: number; fields: string[] };

/** The records of a CSV text: quotes, commas and line breaks inside quotes, CRLF, CR or LF between records. */
function readRecords(text: string): { records: CsvRecord[]; unclosedAt: number | null } {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let atStart = true;
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    fields.push(field);
    const blank = fields.length === 1 && fields[0] === '';
    if (!blank) records.push({ line: recordLine, fields });
    fields = [];
    field = '';
    atStart = true;
  };

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i += 1;
        field += '\n';
        line += 1;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && atStart) {
      inQuotes = true;
      atStart = false;
    } else if (c === ',') {
      fields.push(field);
      field = '';
      atStart = true;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      field += c;
      atStart = false;
    }
  }
  if (inQuotes) return { records, unclosedAt: recordLine };
  if (field !== '' || fields.length > 0) endRecord();
  return { records, unclosedAt: null };
}

function readCsv(text: string, limits: CostBatchLimits | undefined): CostBatchResult {
  const { records, unclosedAt } = readRecords(withoutMark(text));
  if (unclosedAt !== null) return { rows: [], errors: [{ line: unclosedAt, reason: 'CSV_QUOTE' }] };
  // Nothing at all is empty. A single line is read as the header: a line of data without one is
  // then a header problem (the columns are missing), not an empty file; a good header alone is empty.
  if (records.length === 0) return finish([], [], limits);

  const [header, ...data] = records;
  const names = header.fields.map((name) => trimSpec(name).toLowerCase());
  const problems: BatchError[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      problems.push({ line: header.line, reason: 'HEADER_DUPLICATE', values: { column: name } });
    } else if (!(CSV_COLUMNS as readonly string[]).includes(name)) {
      problems.push({ line: header.line, reason: 'HEADER_UNKNOWN', values: { column: name } });
    }
    seen.add(name);
  }
  for (const column of REQUIRED_COLUMNS) {
    if (!seen.has(column)) {
      problems.push({ line: header.line, reason: 'HEADER_MISSING', values: { column } });
    }
  }
  if (problems.length > 0) return { rows: [], errors: problems };

  const raws: Raw[] = data.map(({ line, fields }) => {
    if (fields.length !== names.length) {
      return { line, error: 'COLUMN_COUNT' };
    }
    const values: Fields = {};
    names.forEach((name, index) => {
      values[name as Column] = fields[index];
    });
    return { line, fields: values };
  });
  const result = finish(raws, [], limits);
  // The text of a column-count problem says how many were found.
  return {
    rows: result.rows,
    errors: result.errors.map((error) => {
      if (error.reason !== 'COLUMN_COUNT') return error;
      const found = data.find((d) => d.line === error.line)?.fields.length ?? 0;
      return { ...error, values: { expected: names.length, found } };
    }),
  };
}

/**
 * Reads a batch of costs. `rows` are in the shape of the request body, ready to send; `errors` is
 * empty exactly when `rows` is the whole batch. See the types above for what an error says.
 */
export function parseCostBatch(input: CostBatchInput, limits?: CostBatchLimits): CostBatchResult {
  return input.kind === 'json' ? readJson(input.text, limits) : readCsv(input.text, limits);
}
