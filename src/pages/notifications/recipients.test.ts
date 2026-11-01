import { describe, expect, it } from 'vitest';
import { parseRecipients, recipientsProblem, visibleId } from './recipients';

const NBSP = String.fromCharCode(0xa0);
const IDEOGRAPHIC = String.fromCharCode(0x3000);
const LS = String.fromCharCode(0x2028);
// In the contract's definition of whitespace but not in String.trim, and the other way round.
const NEL = String.fromCharCode(0x85);
const FS = String.fromCharCode(0x1c);
const BOM = String.fromCharCode(0xfeff);

describe('parseRecipients: one account id per line', () => {
  it('takes one id per line in the order written', () => {
    expect(parseRecipients('a1\nb2\nc3')).toEqual({ ids: ['a1', 'b2', 'c3'], repeated: 0 });
  });

  it('reads Windows, old Mac and Unicode line ends', () => {
    expect(parseRecipients('a\r\nb\rc\nd').ids).toEqual(['a', 'b', 'c', 'd']);
    expect(parseRecipients(`a${LS}b`).ids).toEqual(['a', 'b']);
  });

  it('trims every line with the contract definition of whitespace, not String.trim', () => {
    expect(parseRecipients(`  a1 \n${NBSP}b2${IDEOGRAPHIC}\n\t c3\t`).ids).toEqual([
      'a1',
      'b2',
      'c3',
    ]);
  });

  it('trims the characters that only the contract counts as whitespace, and keeps the one that only String.trim does', () => {
    expect(parseRecipients(`${NEL}a1${FS}`).ids).toEqual(['a1']);
    expect(parseRecipients(`${NEL}\n${FS}`).ids).toEqual([]);
    expect(parseRecipients(`${BOM}a1`).ids).toEqual([`${BOM}a1`]);
  });

  it('drops empty lines and lines of whitespace only', () => {
    expect(parseRecipients('\n\n a \n   \n\t\nb\n\n')).toEqual({ ids: ['a', 'b'], repeated: 0 });
    expect(parseRecipients('')).toEqual({ ids: [], repeated: 0 });
    expect(parseRecipients(`${NBSP}\n${IDEOGRAPHIC}`)).toEqual({ ids: [], repeated: 0 });
  });

  it('removes repeats, keeping the first place, and counts how many lines were repeats', () => {
    expect(parseRecipients('a\nb\na\n b \na\nc')).toEqual({ ids: ['a', 'b', 'c'], repeated: 3 });
  });

  it('treats ids that differ in case as different ids (the backend decides what an id is)', () => {
    expect(parseRecipients('Abc\nabc').ids).toEqual(['Abc', 'abc']);
  });

  it('does not try to split a line: a comma or space inside a line stays in the id', () => {
    expect(parseRecipients('a, b\nc d').ids).toEqual(['a, b', 'c d']);
  });

  it('keeps ids in any script and emoji as written', () => {
    const text = ['สวัสดี', 'مرحبا', '用户', '😀1', 'Ñandú'].join('\n');
    expect(parseRecipients(text).ids).toEqual(['สวัสดี', 'مرحبا', '用户', '😀1', 'Ñandú']);
  });

  it('copes with thousands of lines', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `id-${i % 2500}`).join('\n');
    const result = parseRecipients(text);
    expect(result.ids.length).toBe(2500);
    expect(result.repeated).toBe(2500);
  });
});

describe('recipientsProblem', () => {
  it('is "empty" without an id', () => {
    expect(recipientsProblem(0, 1000)).toBe('empty');
    expect(recipientsProblem(0, undefined)).toBe('empty');
  });

  it('is "tooMany" above the limit of GET /meta, and fine at the limit', () => {
    expect(recipientsProblem(1001, 1000)).toBe('tooMany');
    expect(recipientsProblem(1000, 1000)).toBeNull();
  });

  it('does not check the limit when the meta has none (missing, null, not a number, zero, negative): the backend decides', () => {
    for (const max of [undefined, null, '1000', Number.NaN, 0, -5, Number.POSITIVE_INFINITY]) {
      expect(recipientsProblem(5000, max as number | undefined), String(max)).toBeNull();
    }
  });
});

describe('visibleId: an account id with characters that cannot be seen', () => {
  it('leaves an ordinary id as it is, in any script', () => {
    expect(visibleId('00000000-0000-0000-0000-0000000000a1')).toBe(
      '00000000-0000-0000-0000-0000000000a1',
    );
    expect(visibleId('ผู้ใช้-ñandú-مرحبا-用户')).toBe('ผู้ใช้-ñandú-مرحبا-用户');
  });

  it('writes a zero width space, a byte order mark and a no-break space as their code points', () => {
    expect(visibleId(`${String.fromCharCode(0xfeff)}a1${String.fromCharCode(0x200b)}`)).toBe(
      '\u2039U+FEFF\u203Aa1\u2039U+200B\u203A',
    );
    expect(visibleId(`a${String.fromCharCode(0xa0)}b`)).toBe('a\u2039U+00A0\u203Ab');
  });
});
