import { describe, expect, it } from 'vitest';
import {
  emptyTargetingForm,
  fromTargeting,
  isOvernight,
  summarizeTargeting,
  toTargeting,
  validateTargeting,
} from './targeting';

const intl = {
  messages: {
    'ads.targeting.summary.platforms': 'x',
  } as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }, values?: Record<string, string | number>) =>
    `${id}${values ? JSON.stringify(values) : ''}`,
};

describe('fromTargeting', () => {
  it('reads every key, and an empty or missing targeting as the empty form', () => {
    expect(fromTargeting(null)).toEqual(emptyTargetingForm());
    expect(fromTargeting({})).toEqual(emptyTargetingForm());
    expect(
      fromTargeting({
        platforms: ['ANDROID'],
        geo: ['TH', 'ID'],
        os_version_min: '13',
        app_version_min: '1.2.0',
        languages: ['th'],
        day_parts: [{ start: '8:00', end: '22:30' }],
      }),
    ).toEqual({
      platforms: ['ANDROID'],
      geo: ['TH', 'ID'],
      osVersionMin: '13',
      appVersionMin: '1.2.0',
      languages: ['th'],
      dayParts: [{ start: '8:00', end: '22:30' }],
    });
  });

  it('ignores what has the wrong type instead of breaking', () => {
    expect(
      fromTargeting({
        platforms: 'ANDROID',
        geo: [1, 'TH', null],
        os_version_min: 13,
        languages: { a: 1 },
        day_parts: [{ start: 8 }, null, { start: '1:00', end: '2:00' }],
      } as never),
    ).toEqual({
      platforms: [],
      geo: ['TH'],
      osVersionMin: '',
      appVersionMin: '',
      languages: [],
      dayParts: [
        { start: '', end: '' },
        { start: '1:00', end: '2:00' },
      ],
    });
  });
});

describe('toTargeting', () => {
  it('leaves out every key that is empty, so that "no limit" is not written as an empty list', () => {
    expect(toTargeting(emptyTargetingForm())).toEqual({});
    expect(
      toTargeting({
        ...emptyTargetingForm(),
        platforms: ['IOS'],
        geo: ['TH'],
        osVersionMin: ' 13 ',
        dayParts: [{ start: '8:00', end: '9:00' }],
      }),
    ).toEqual({
      platforms: ['IOS'],
      geo: ['TH'],
      os_version_min: '13',
      day_parts: [{ start: '8:00', end: '9:00' }],
    });
  });

  it('writes null for a key that the unit had and the form emptied, so that a merge patch removes it, and for no other key', () => {
    const before = { geo: ['TH'], languages: ['th'], app_version_min: '1.0' };
    expect(toTargeting({ ...emptyTargetingForm(), languages: ['th'] }, before)).toEqual({
      languages: ['th'],
      geo: null,
      app_version_min: null,
    });
    expect(toTargeting(emptyTargetingForm(), {})).toEqual({});
    expect(toTargeting(emptyTargetingForm(), null)).toEqual({});
  });

  it('writes null for every one of the six keys when the form emptied it, under the name the backend uses', () => {
    const before = {
      platforms: ['IOS'],
      geo: ['TH'],
      os_version_min: '13',
      app_version_min: '1.0',
      languages: ['th'],
      day_parts: [{ start: '8:00', end: '9:00' }],
    };
    expect(toTargeting(emptyTargetingForm(), before)).toEqual({
      platforms: null,
      geo: null,
      os_version_min: null,
      app_version_min: null,
      languages: null,
      day_parts: null,
    });
    // The last time row removed: the key `day_parts` (not `dayParts`) goes as null.
    const withoutParts = { ...emptyTargetingForm(), platforms: ['IOS'] };
    const sent = toTargeting(withoutParts, before);
    expect(Object.keys(sent)).toContain('day_parts');
    expect(sent.day_parts).toBeNull();
    expect(Object.keys(sent)).not.toContain('dayParts');
  });

  it('does not send a row of the time list that is half filled in', () => {
    expect(
      toTargeting({
        ...emptyTargetingForm(),
        dayParts: [
          { start: '8:00', end: '' },
          { start: '', end: '' },
        ],
      }),
    ).toEqual({});
  });
});

describe('validateTargeting', () => {
  it('accepts the empty form and a good one', () => {
    expect(validateTargeting(emptyTargetingForm())).toEqual({});
    expect(
      validateTargeting({
        platforms: ['ANDROID'],
        geo: ['TH', 'ID'],
        osVersionMin: '13',
        appVersionMin: '1.2.3',
        languages: ['th', 'ar-SA', 'zh-Hans'],
        dayParts: [{ start: '23:00', end: '2:00' }],
      }),
    ).toEqual({});
  });

  it('names the field of every fault, by the rules of 22.5', () => {
    expect(validateTargeting({ ...emptyTargetingForm(), geo: ['th'] })).toEqual({ geo: 'country' });
    expect(validateTargeting({ ...emptyTargetingForm(), geo: ['THA'] })).toEqual({
      geo: 'country',
    });
    expect(validateTargeting({ ...emptyTargetingForm(), osVersionMin: 'abc' })).toEqual({
      osVersionMin: 'version',
    });
    expect(validateTargeting({ ...emptyTargetingForm(), appVersionMin: '1..2' })).toEqual({
      appVersionMin: 'version',
    });
    expect(validateTargeting({ ...emptyTargetingForm(), appVersionMin: '1.2-beta' })).toEqual({
      appVersionMin: 'version',
    });
    expect(validateTargeting({ ...emptyTargetingForm(), languages: ['not a tag'] })).toEqual({
      languages: 'language',
    });
    expect(validateTargeting({ ...emptyTargetingForm(), languages: ['a'.repeat(36)] })).toEqual({
      languages: 'language',
    });
    expect(
      validateTargeting({ ...emptyTargetingForm(), dayParts: [{ start: '25:00', end: '1:00' }] }),
    ).toEqual({ dayParts: 'dayPart' });
    expect(
      validateTargeting({ ...emptyTargetingForm(), dayParts: [{ start: '8:00', end: '' }] }),
    ).toEqual({ dayParts: 'dayPart' });
  });

  it('takes an empty row of the list as not there, and two faults in two fields as two', () => {
    expect(
      validateTargeting({ ...emptyTargetingForm(), dayParts: [{ start: '', end: '' }] }),
    ).toEqual({});
    expect(validateTargeting({ ...emptyTargetingForm(), geo: ['x'], osVersionMin: 'y' })).toEqual({
      geo: 'country',
      osVersionMin: 'version',
    });
  });
});

describe('isOvernight', () => {
  it('is true when the start is later than the end, the two ends being included', () => {
    expect(isOvernight({ start: '23:00', end: '2:00' })).toBe(true);
    expect(isOvernight({ start: '8:00', end: '22:30' })).toBe(false);
    expect(isOvernight({ start: '8:00', end: '8:00' })).toBe(false);
    expect(isOvernight({ start: '', end: '2:00' })).toBe(false);
  });
});

describe('summarizeTargeting', () => {
  it('says "no limit" for an empty or missing targeting', () => {
    expect(summarizeTargeting(intl, null)).toBe('ads.targeting.summary.none');
    expect(summarizeTargeting(intl, {})).toBe('ads.targeting.summary.none');
    expect(summarizeTargeting(intl, 'x' as never)).toBe('ads.targeting.summary.none');
  });

  it('lists each key that is set, in a fixed order, as text, never as an object', () => {
    const text = summarizeTargeting(intl, {
      day_parts: [{ start: '8:00', end: '9:00' }],
      geo: ['TH', 'ID'],
      platforms: ['ANDROID'],
    });
    expect(text.indexOf('ads.targeting.summary.platforms')).toBeLessThan(
      text.indexOf('ads.targeting.summary.geo'),
    );
    expect(text.indexOf('ads.targeting.summary.geo')).toBeLessThan(
      text.indexOf('ads.targeting.summary.dayParts'),
    );
    expect(text).toContain('TH, ID');
    expect(text).toContain('8:00–9:00');
    expect(text).not.toContain('[object Object]');
  });

  it('ignores an empty list and a value of the wrong type', () => {
    expect(summarizeTargeting(intl, { geo: [], platforms: null, languages: 5 } as never)).toBe(
      'ads.targeting.summary.none',
    );
  });
});
