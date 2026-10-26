import { describe, expect, it } from 'vitest';
import {
  addDecimals,
  compareDecimals,
  formatAmount,
  isValidPrice,
  roundDecimal,
  sumDecimals,
  toDecimalString,
} from './decimal';

describe('toDecimalString: what the backend sent as a decimal, as text without an exponent', () => {
  it('keeps a string exactly as it is, trailing zeros and ten digits included', () => {
    expect(toDecimalString('0.0000000001')).toBe('0.0000000001');
    expect(toDecimalString('12345678.1234567890')).toBe('12345678.1234567890');
    expect(toDecimalString('0.4000')).toBe('0.4000');
    expect(toDecimalString('0')).toBe('0');
  });

  it('writes a number without an exponent (JSON numbers arrive as numbers)', () => {
    expect(toDecimalString(0.0000001)).toBe('0.0000001');
    expect(toDecimalString(1e-10)).toBe('0.0000000001');
    expect(toDecimalString(1.5e-7)).toBe('0.00000015');
    expect(toDecimalString(123456789012)).toBe('123456789012');
    expect(toDecimalString(1e21)).toBe('1000000000000000000000');
    expect(toDecimalString(0)).toBe('0');
  });

  it('expands a string that has an exponent', () => {
    expect(toDecimalString('6E-6')).toBe('0.000006');
    expect(toDecimalString('1.25e3')).toBe('1250');
    expect(toDecimalString('1E+3')).toBe('1000');
  });

  it('is null for what is not a decimal: nothing, text, NaN, infinity, a boolean, an object', () => {
    for (const bad of [
      null,
      undefined,
      '',
      ' ',
      'abc',
      '1,5',
      '.5',
      '5.',
      '--1',
      NaN,
      Infinity,
      true,
      {},
      [],
    ]) {
      expect(toDecimalString(bad), String(bad)).toBeNull();
    }
  });

  it('keeps a minus sign (the caller decides what a negative amount means)', () => {
    expect(toDecimalString('-0.5')).toBe('-0.5');
    expect(toDecimalString(-2.5)).toBe('-2.5');
  });
});

describe('addDecimals and sumDecimals: exact, never through a float', () => {
  it('adds what a float gets wrong', () => {
    expect(addDecimals('0.1', '0.2')).toBe('0.3');
    expect(addDecimals('0.0000000001', '0.0000000002')).toBe('0.0000000003');
    expect(addDecimals('12345678.1234567890', '0.0000000010')).toBe('12345678.1234567900');
  });

  it('adds numbers of different scales and keeps the larger scale', () => {
    expect(addDecimals('1', '0.50')).toBe('1.50');
    expect(addDecimals('999999999999999999.99', '0.01')).toBe('1000000000000000000.00');
  });

  it('adds a negative number', () => {
    expect(addDecimals('1.5', '-0.5')).toBe('1.0');
    expect(addDecimals('0.1', '-0.3')).toBe('-0.2');
  });

  it('sums a list, skips the nulls, and is null when there is nothing to add', () => {
    expect(sumDecimals(['0.1', null, '0.2', '0.3'])).toBe('0.6');
    expect(sumDecimals([null, null])).toBeNull();
    expect(sumDecimals([])).toBeNull();
    expect(sumDecimals(['0'])).toBe('0');
  });

  it('sums ten thousand small amounts without drift', () => {
    expect(sumDecimals(Array.from({ length: 10000 }, () => '0.0000000001'))).toBe('0.0000010000');
  });
});

describe('compareDecimals', () => {
  it('orders numbers of different scales', () => {
    expect(compareDecimals('0.4', '0.40')).toBe(0);
    expect(compareDecimals('0.4', '0.41')).toBe(-1);
    expect(compareDecimals('10', '9.9999999999')).toBe(1);
    expect(compareDecimals('-1', '0')).toBe(-1);
    expect(compareDecimals('-0.0', '0')).toBe(0);
  });
});

describe('roundDecimal: half up, on the text', () => {
  it('rounds the half up and pads with zeros', () => {
    expect(roundDecimal('1.2345675', 6)).toBe('1.234568');
    expect(roundDecimal('1.2345674', 6)).toBe('1.234567');
    expect(roundDecimal('2', 2)).toBe('2.00');
    expect(roundDecimal('0.999999999', 2)).toBe('1.00');
    expect(roundDecimal('0.0000004', 6)).toBe('0.000000');
  });
});

describe('formatAmount: at most six decimals (the contract), never an exponent', () => {
  it('shows two to six decimals and drops zeros beyond two', () => {
    expect(formatAmount('12.5')).toBe('12.50');
    expect(formatAmount('12.1234567890')).toBe('12.123457');
    expect(formatAmount('0.000006')).toBe('0.000006');
    expect(formatAmount('3.100000')).toBe('3.10');
  });

  it('shows an exact zero as 0 and an amount below one millionth as such, not as zero', () => {
    expect(formatAmount('0')).toBe('0');
    expect(formatAmount('0.0000000000')).toBe('0');
    expect(formatAmount('0.0000000001')).toBe('<0.000001');
  });

  it('does not lose the digits of a very large amount', () => {
    expect(formatAmount('123456789012345678.5')).toBe('123456789012345678.50');
  });

  it('is null for a negative amount: money in this report is never negative', () => {
    expect(formatAmount('-1')).toBeNull();
  });
});

describe("isValidPrice: a non negative decimal with up to ten digits after the point (the limit of 1000000 is the backend's to judge)", () => {
  it('accepts', () => {
    for (const good of [
      '0',
      '0.0',
      '1',
      '0.4',
      '12345678',
      '12345678.1234567890',
      '999999.9999999999',
      '1000000',
      '1000001',
      '0.0000000001',
      '007',
    ]) {
      expect(isValidPrice(good), good).toBe(true);
    }
  });

  it('refuses', () => {
    for (const bad of [
      '',
      ' ',
      '-1',
      '-0',
      '+1',
      '1e3',
      '1E-3',
      '.5',
      '5.',
      '1,5',
      '1 000',
      '0.00000000001',
      'NaN',
      'Infinity',
      '٣',
      '1_0',
    ]) {
      expect(isValidPrice(bad), bad).toBe(false);
    }
  });
});
