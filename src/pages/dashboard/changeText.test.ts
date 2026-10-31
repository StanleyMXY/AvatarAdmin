import { describe, expect, it } from 'vitest';
import { describeChange } from './changeText';

describe('describeChange', () => {
  it('writes a rise with a plus sign and a fall with a minus sign, rounded to one decimal', () => {
    expect(describeChange(12.34, 'relative', 'en-US', 'pp', true)).toEqual({
      text: '+12.3%',
      tone: 'rise',
    });
    expect(describeChange(-3.06, 'relative', 'en-US', 'pp', true)).toEqual({
      text: '-3.1%',
      tone: 'fall',
    });
    expect(describeChange(1234.5, 'relative', 'en-US', 'pp', true).text).toBe('+1,234.5%');
  });

  it('writes percentage points with the unit of the language', () => {
    expect(describeChange(5, 'points', 'en-US', 'pp', true)).toEqual({
      text: '+5 pp',
      tone: 'rise',
    });
    expect(describeChange(-10.8, 'points', 'zh-CN', '个百分点', true)).toEqual({
      text: '-10.8 个百分点',
      tone: 'fall',
    });
  });

  it('writes 0 without a sign and without a colour, also for a change that rounds to 0', () => {
    expect(describeChange(0, 'relative', 'en-US', 'pp', true)).toEqual({
      text: '0%',
      tone: 'flat',
    });
    expect(describeChange(0.04, 'relative', 'en-US', 'pp', true)).toEqual({
      text: '0%',
      tone: 'flat',
    });
    expect(describeChange(-0.04, 'relative', 'en-US', 'pp', true)).toEqual({
      text: '0%',
      tone: 'flat',
    });
    expect(describeChange(-0.04, 'points', 'en-US', 'pp', true)).toEqual({
      text: '0 pp',
      tone: 'flat',
    });
  });

  it('writes a dash when the change cannot be told, never NaN, Infinity or null', () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(describeChange(value, 'relative', 'en-US', 'pp', true)).toEqual({
        text: '—',
        tone: 'none',
      });
    }
  });
});

describe('describeChange: a change that has a provisional day on one side', () => {
  it('writes the figure as usual but with a neutral tone, never rise or fall', () => {
    expect(describeChange(12.34, 'relative', 'en-US', 'pp', false)).toEqual({
      text: '+12.3%',
      tone: 'provisional',
    });
    expect(describeChange(-3.06, 'relative', 'en-US', 'pp', false)).toEqual({
      text: '-3.1%',
      tone: 'provisional',
    });
    expect(describeChange(5, 'points', 'en-US', 'pp', false)).toEqual({
      text: '+5 pp',
      tone: 'provisional',
    });
  });

  it('still writes a dash when the change cannot be told', () => {
    expect(describeChange(null, 'relative', 'en-US', 'pp', false)).toEqual({
      text: '—',
      tone: 'none',
    });
  });
});
