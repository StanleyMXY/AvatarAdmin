import {
  TEXT_RULE_NOTE_MAX,
  TEXT_RULE_PATTERN_MAX,
  type TextRule,
  type TextRuleInput,
  type TextRuleLevel,
  type TextRuleMatchMode,
} from '../../services/moderation';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

/** A rule as it is being edited. `key` is the row's identity on the page only; `id` is the backend's and is missing on a new rule. */
export type RuleRow = {
  key: string;
  id?: string;
  pattern: string;
  matchMode: TextRuleMatchMode;
  level: TextRuleLevel;
  note: string;
};

let counter = 0;
export const newRowKey = (): string => `row-${++counter}`;

export const blankRow = (): RuleRow => ({
  key: newRowKey(),
  pattern: '',
  matchMode: 'SUBSTRING',
  level: 'REVIEW',
  note: '',
});

export const toRows = (items: TextRule[]): RuleRow[] =>
  items.map((item) => ({
    key: newRowKey(),
    id: item.id,
    pattern: item.pattern,
    matchMode: item.matchMode,
    level: item.level,
    note: item.note ?? '',
  }));

/** The list sent by the save: the ends of the texts trimmed with the contract's set, `id` only where the rule has one. */
export const toInputs = (rows: RuleRow[]): TextRuleInput[] =>
  rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    pattern: trimSpec(row.pattern),
    matchMode: row.matchMode,
    level: row.level,
    note: trimSpec(row.note),
  }));

export type RowProblem = { pattern?: 'EMPTY' | 'TOO_LONG'; note?: 'TOO_LONG' };

/** What the page can see wrong in a row before it asks the backend (same counting as the backend: trimmed, code points). */
export function rowProblem(row: RuleRow): RowProblem {
  const problem: RowProblem = {};
  const pattern = trimSpec(row.pattern);
  if (pattern === '') problem.pattern = 'EMPTY';
  else if (countCodePoints(pattern) > TEXT_RULE_PATTERN_MAX) problem.pattern = 'TOO_LONG';
  if (countCodePoints(trimSpec(row.note)) > TEXT_RULE_NOTE_MAX) problem.note = 'TOO_LONG';
  return problem;
}

export const hasProblem = (problem: RowProblem): boolean =>
  problem.pattern !== undefined || problem.note !== undefined;

/**
 * Whether this browser can compile the regular expression. Only a hint: the backend compiles with
 * Java's `Pattern`, whose syntax differs, and it has the last word.
 */
export function regexCompiles(pattern: string): boolean {
  try {
    new RegExp(pattern, 'iu');
    return true;
  } catch {
    return false;
  }
}

export const isDirty = (rows: RuleRow[], saved: RuleRow[]): boolean =>
  JSON.stringify(toInputs(rows)) !== JSON.stringify(toInputs(saved));

/**
 * Whether two readings of the list are the same list: the same rules, with the same ids and
 * contents, in the same order. The backend sends no time for the list, so the content is the version.
 */
export const sameRules = (a: RuleRow[], b: RuleRow[]): boolean => {
  const content = (rows: RuleRow[]) =>
    JSON.stringify(
      rows.map((row) => [row.id ?? null, row.pattern, row.matchMode, row.level, row.note]),
    );
  return content(a) === content(b);
};

/**
 * Sorts the details of a refused save: a number is the index of an element of the list that was
 * sent (contract 11.2), `items` is the list as a whole (too many rules). Anything else is returned
 * as `other`.
 */
export function sortDetails(
  details: { ref: string; text: string }[],
  rowCount: number,
): { byRow: Map<number, string[]>; table: string[]; other: string[] } {
  const byRow = new Map<number, string[]>();
  const table: string[] = [];
  const other: string[] = [];
  for (const { ref, text } of details) {
    if (/^\d+$/.test(ref) && Number(ref) < rowCount) {
      const index = Number(ref);
      const list = byRow.get(index) ?? [];
      if (!list.includes(text)) list.push(text);
      byRow.set(index, list);
    } else if (ref === 'items') {
      if (!table.includes(text)) table.push(text);
    } else {
      other.push(text);
    }
  }
  return { byRow, table, other };
}
