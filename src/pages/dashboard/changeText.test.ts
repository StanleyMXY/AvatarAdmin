import { describe, expect, it } from 'vitest';
import { describeChange } from './changeText';

describe('describeChange', () => {
  it('writes a rise with a plus sign and a fall with a minus sign, rounded to one decimal', () => {
    expect(describeChange(12.34, 'relative', 'en-US', 'pp')).toEqual({
      text: '+12.3%',
      tone: 'rise',
    });
    expect(describeChange(-3.06, 'relative', 'en-US', 'pp')).toEqual({
      text: '-3.1%',
      tone: 'fall',
    });
    expect(describeChange(1234.5, 'relative', 'en-US', 'pp').text).toBe('+1,234.5%');
  });

  it('writes percentage points with the unit of the language', () => {
    expect(describeChange(5, 'points', 'en-US', 'pp')).toEqual({ text: '+5 pp', tone: 'rise' });
    expect(describeChange(-10.8, 'points', 'zh-CN', '个百分点')).toEqual({
      text: '-10.8 个百分点',
      tone: 'fall',
    });
  });

  it('writes 0 without a sign and without a colour, also for a change that rounds to 0', () => {
    expect(describeChange(0, 'relative', 'en-US', 'pp')).toEqual({ text: '0%', tone: 'flat' });
    expect(describeChange(0.04, 'relative', 'en-US', 'pp')).toEqual({ text: '0%', tone: 'flat' });
    expect(describeChange(-0.04, 'relative', 'en-US', 'pp')).toEqual({ text: '0%', tone: 'flat' });
    expect(describeChange(-0.04, 'points', 'en-US', 'pp')).toEqual({ text: '0 pp', tone: 'flat' });
  });

  it('writes a dash when the change cannot be told, never NaN, Infinity or null', () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(describeChange(value, 'relative', 'en-US', 'pp')).toEqual({ text: '—', tone: 'none' });
    }
  });
});
