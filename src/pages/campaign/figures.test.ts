import { describe, expect, it } from 'vitest';
import { costsText, moneyText, numberOf, rateText, shareText, unitCostText } from './figures';

describe('numberOf', () => {
  it('takes a finite number and a decimal written as text, and nothing else', () => {
    expect(numberOf(5)).toBe(5);
    expect(numberOf(0)).toBe(0);
    expect(numberOf('12.30')).toBe(12.3);
    expect(numberOf('-4')).toBe(-4);
    for (const bad of [
      null,
      undefined,
      '',
      ' ',
      'abc',
      '1e3',
      '1,5',
      Number.NaN,
      Infinity,
      {},
      [],
      true,
    ]) {
      expect(numberOf(bad), String(bad)).toBeNull();
    }
  });
});

describe('moneyText', () => {
  it('writes two decimals, the thousands in the language of the page, and a dash for what is not an amount', () => {
    expect(moneyText(12.3, 'en-US')).toBe('12.30');
    expect(moneyText('1234.5', 'en-US')).toBe('1,234.50');
    expect(moneyText(0, 'en-US')).toBe('0.00');
    expect(moneyText(1234.5, 'de-DE')).toBe('1.234,50');
    expect(moneyText(null, 'en-US')).toBe('—');
    expect(moneyText('abc', 'en-US')).toBe('—');
  });
});

describe('rateText', () => {
  it('divides the counts and writes a percentage', () => {
    expect(rateText(undefined, 1, 4, 'en-US')).toBe('25%');
    expect(rateText(null, 1, 3, 'en-US')).toBe('33.3%');
    expect(rateText(null, 0, 10, 'en-US')).toBe('0%');
  });

  it('is a dash when the denominator is 0, whatever the backend says, and never infinity or not-a-number', () => {
    expect(rateText(0.5, 3, 0, 'en-US')).toBe('—');
    expect(rateText(Infinity, 3, 0, 'en-US')).toBe('—');
    expect(rateText(null, 0, 0, 'en-US')).toBe('—');
  });

  it('is a dash when the denominator is 0 and the count above it is not known, however good the rate that was sent', () => {
    expect(rateText(0.4, null, 0, 'en-US')).toBe('—');
    expect(rateText(0.4, 'x', 0, 'en-US')).toBe('—');
    expect(rateText(0.4, 3, -1, 'en-US')).toBe('—');
    expect(rateText(0.4, -3, null, 'en-US')).toBe('—');
  });

  it('is a dash for a negative count, so that no derived number is negative', () => {
    expect(rateText(null, -1, 4, 'en-US')).toBe('—');
    expect(rateText(null, 1, -4, 'en-US')).toBe('—');
  });

  it('uses the rate the backend gave when a count is missing, and a dash when that is no good either', () => {
    expect(rateText(0.25, null, 4, 'en-US')).toBe('25%');
    expect(rateText(0.25, 1, null, 'en-US')).toBe('25%');
    expect(rateText(-0.2, null, null, 'en-US')).toBe('—');
    expect(rateText(null, null, null, 'en-US')).toBe('—');
    expect(rateText('x', null, null, 'en-US')).toBe('—');
  });

  it('keeps a rate above 100% as it is', () => {
    expect(rateText(null, 5, 4, 'en-US')).toBe('125%');
  });
});

describe('unitCostText', () => {
  it('divides the cost by the count and writes two decimals', () => {
    expect(unitCostText(null, 100, 8, 'en-US')).toBe('12.50');
    expect(unitCostText(null, '10.00', 3, 'en-US')).toBe('3.33');
    expect(unitCostText(null, 0, 5, 'en-US')).toBe('0.00');
  });

  it('is a dash when the count is 0, and for a cost that is missing or negative', () => {
    expect(unitCostText(12, 100, 0, 'en-US')).toBe('—');
    expect(unitCostText(null, null, 5, 'en-US')).toBe('—');
    expect(unitCostText(null, -5, 5, 'en-US')).toBe('—');
    expect(unitCostText(-3, 100, null, 'en-US')).toBe('—');
  });

  it('is a dash when the count is 0 or negative and the cost is not known, however good the figure that was sent', () => {
    expect(unitCostText(3, null, 0, 'en-US')).toBe('—');
    expect(unitCostText(3, null, -1, 'en-US')).toBe('—');
    expect(unitCostText(3, -10, null, 'en-US')).toBe('—');
  });

  it('uses the figure the backend gave when the count is missing', () => {
    expect(unitCostText('4.5', 100, null, 'en-US')).toBe('4.50');
  });
});

describe('shareText', () => {
  it('is the part of the whole as a percentage, and a dash when the whole is 0', () => {
    expect(shareText(30, 100, 'en-US')).toBe('30%');
    expect(shareText(0, 0, 'en-US')).toBe('—');
    expect(shareText(null, 10, 'en-US')).toBe('—');
    expect(shareText(5, -1, 'en-US')).toBe('—');
  });
});

describe('costsText', () => {
  it('writes each currency with its amount, apart from the others', () => {
    expect(
      costsText(
        [
          { currency: 'USD', amount: 12.3 },
          { currency: 'EUR', amount: '4' },
        ],
        'en-US',
      ),
    ).toBe('USD 12.30 / EUR 4.00');
  });

  it('is a dash when there is no cost or the list is not a list', () => {
    expect(costsText([], 'en-US')).toBe('—');
    expect(costsText(null, 'en-US')).toBe('—');
    expect(costsText('x', 'en-US')).toBe('—');
  });

  it('skips an entry that has no amount and does not show an object as text', () => {
    expect(
      costsText(
        [
          { currency: 'USD', amount: null },
          { currency: { a: 1 }, amount: 1 },
        ],
        'en-US',
      ),
    ).toBe('{"a":1} 1.00');
  });
});
