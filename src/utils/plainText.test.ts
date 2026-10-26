import { describe, expect, it } from 'vitest';
import { plainText } from './plainText';

describe('plainText', () => {
  it.each([
    ['text', 'text'],
    ['สวัสดี مرحبا 🙂', 'สวัสดี مرحبا 🙂'],
    [12, '12'],
    [false, 'false'],
    [null, ''],
    [undefined, ''],
    [{ a: 1 }, '{"a":1}'],
    [['x', 2], '["x",2]'],
  ])('writes %j as %j', (value, text) => {
    expect(plainText(value)).toBe(text);
  });

  it('does not throw on a value that cannot be written as JSON', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(plainText(loop)).toBe('');
    expect(plainText(10n)).toBe('10');
  });
});
