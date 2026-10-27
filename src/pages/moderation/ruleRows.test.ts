import { describe, expect, it } from 'vitest';
import {
  blankRow,
  hasProblem,
  isDirty,
  regexCompiles,
  rowProblem,
  sortDetails,
  toInputs,
  toRows,
} from './ruleRows';

const WIDE_SPACE = String.fromCodePoint(0x3000);
const NBSP = String.fromCharCode(0xa0);
const saved = toRows([
  { id: 'a', pattern: 'คำ', matchMode: 'SUBSTRING', level: 'BLOCK', note: null },
  { id: 'b', pattern: 'كلمة', matchMode: 'WORD', level: 'REVIEW', note: 'ملاحظة' },
]);

describe('rows and inputs', () => {
  it('keeps the id of a saved rule and leaves it out of a new one; a null note becomes an empty one', () => {
    expect(saved[0].note).toBe('');
    expect(toInputs([...saved, blankRow()])).toEqual([
      { id: 'a', pattern: 'คำ', matchMode: 'SUBSTRING', level: 'BLOCK', note: '' },
      { id: 'b', pattern: 'كلمة', matchMode: 'WORD', level: 'REVIEW', note: 'ملاحظة' },
      { pattern: '', matchMode: 'SUBSTRING', level: 'REVIEW', note: '' },
    ]);
  });

  it('trims the ends with the contract set and keeps the inside', () => {
    const [input] = toInputs([
      { ...blankRow(), pattern: `${WIDE_SPACE} a  b ${NBSP}`, note: ` ${WIDE_SPACE}n ` },
    ]);
    expect(input.pattern).toBe('a  b');
    expect(input.note).toBe('n');
  });

  it('gives each row its own key, also after a copy', () => {
    const keys = new Set([...saved, ...toRows([]), blankRow(), blankRow()].map((r) => r.key));
    expect(keys.size).toBe(4);
  });
});

describe('rowProblem', () => {
  it('finds an empty text, one of only white space, and one over 200 code points', () => {
    expect(rowProblem({ ...blankRow(), pattern: '' }).pattern).toBe('EMPTY');
    expect(rowProblem({ ...blankRow(), pattern: ` ${WIDE_SPACE}${NBSP}` }).pattern).toBe('EMPTY');
    expect(rowProblem({ ...blankRow(), pattern: 'a'.repeat(201) }).pattern).toBe('TOO_LONG');
    expect(rowProblem({ ...blankRow(), pattern: 'a'.repeat(200) }).pattern).toBeUndefined();
  });

  it('counts code points: an emoji is one, white space at the ends is not counted', () => {
    expect(rowProblem({ ...blankRow(), pattern: '😀'.repeat(200) }).pattern).toBeUndefined();
    expect(rowProblem({ ...blankRow(), pattern: '😀'.repeat(201) }).pattern).toBe('TOO_LONG');
    expect(rowProblem({ ...blankRow(), pattern: ` ${'a'.repeat(200)} ` }).pattern).toBeUndefined();
  });

  it('limits the note to 200 code points and allows it to be empty', () => {
    expect(rowProblem({ ...blankRow(), pattern: 'x', note: '' }).note).toBeUndefined();
    expect(rowProblem({ ...blankRow(), pattern: 'x', note: 'ก'.repeat(200) }).note).toBeUndefined();
    expect(rowProblem({ ...blankRow(), pattern: 'x', note: 'ก'.repeat(201) }).note).toBe(
      'TOO_LONG',
    );
  });

  it('hasProblem is true for either', () => {
    expect(hasProblem({})).toBe(false);
    expect(hasProblem({ note: 'TOO_LONG' })).toBe(true);
    expect(hasProblem({ pattern: 'EMPTY' })).toBe(true);
  });
});

describe('regexCompiles', () => {
  it.each([
    ['\\d+', true],
    ['(?:a|b)', true],
    ['(', false],
    ['[', false],
    ['*a', false],
  ])('%s compiles: %s', (pattern, expected) => {
    expect(regexCompiles(pattern)).toBe(expected);
  });
});

describe('isDirty', () => {
  it('is false for an equal list, also when only the ends of a text differ, and true for any real change', () => {
    expect(
      isDirty(
        saved.map((r) => ({ ...r })),
        saved,
      ),
    ).toBe(false);
    expect(
      isDirty(
        saved.map((r) => ({ ...r, pattern: ` ${r.pattern} ` })),
        saved,
      ),
    ).toBe(false);
    expect(isDirty([...saved, blankRow()], saved)).toBe(true);
    expect(isDirty([saved[1], saved[0]], saved)).toBe(true);
    expect(
      isDirty(
        saved.map((r) => ({ ...r, level: 'BLOCK' as const })),
        saved,
      ),
    ).toBe(true);
    expect(isDirty(saved.slice(1), saved)).toBe(true);
  });
});

describe('sortDetails', () => {
  it('puts a number on its row, items on the table, and anything else apart; the same text twice once', () => {
    const sorted = sortDetails(
      [
        { ref: '0', text: 'a' },
        { ref: '0', text: 'a' },
        { ref: '0', text: 'b' },
        { ref: '2', text: 'c' },
        { ref: 'items', text: 'many' },
        { ref: 'other', text: 'x' },
        { ref: '9', text: 'out of the list' },
        { ref: '-1', text: 'negative' },
      ],
      3,
    );
    expect([...sorted.byRow.entries()]).toEqual([
      [0, ['a', 'b']],
      [2, ['c']],
    ]);
    expect(sorted.table).toEqual(['many']);
    expect(sorted.other).toEqual(['x', 'out of the list', 'negative']);
  });
});
