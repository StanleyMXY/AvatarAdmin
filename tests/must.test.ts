import { describe, expect, it } from 'vitest';
import { must } from './must';

describe('must', () => {
  it('returns a value that exists, including the falsy ones', () => {
    expect(must('ก')).toBe('ก');
    expect(must(0)).toBe(0);
    expect(must('')).toBe('');
    expect(must(false)).toBe(false);
  });

  it('fails with the name of what was missing', () => {
    expect(() => must(undefined, 'the campaign row')).toThrow(/the campaign row/);
    expect(() => must(null)).toThrow(/expected value to exist/);
    expect(() =>
      must(
        [1].find((n) => n > 5),
        'a number above 5',
      ),
    ).toThrow(/a number above 5/);
  });
});
