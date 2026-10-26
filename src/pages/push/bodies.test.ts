import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { PushSchedule } from '../../services/push';
import {
  audienceFields,
  contentFields,
  parseAccountIds,
  pickedInstantUtc,
  scheduleFields,
  scheduleToValues,
  timeZoneNames,
} from './bodies';

describe('parseAccountIds', () => {
  it('splits on lines, spaces and commas (also the wide ones), trims, drops empty ones and repeats', () => {
    const wide = String.fromCharCode(0x3000);
    expect(parseAccountIds(`a1, b2\n\nc3;${wide}d4 ，e5 a1`)).toEqual([
      'a1',
      'b2',
      'c3',
      'd4',
      'e5',
    ]);
  });

  it('is empty for blank text', () => {
    expect(parseAccountIds(' \n ')).toEqual([]);
  });
});

describe('contentFields', () => {
  it('trims the words with the contract set, empties the target of NONE and leaves the picture out without an upload', () => {
    const body = contentFields({
      title: `${String.fromCharCode(0x3000)}Hola ${String.fromCharCode(0x200b)}`,
      body: ' cuerpo ',
      link: { linkType: 'NONE', linkTarget: 'store' },
    });
    // U+3000 is in the contract's set and goes; U+200B is not and stays.
    expect(body.title).toBe(`Hola ${String.fromCharCode(0x200b)}`);
    expect(body).toEqual({ title: body.title, body: 'cuerpo', linkType: 'NONE', linkTarget: '' });
    expect('imageUploadId' in body).toBe(false);
    expect('imageUrl' in body).toBe(false);
  });

  it('carries the upload id and never an address', () => {
    const body = contentFields(
      { title: 't', body: 'b', link: { linkType: 'URL', linkTarget: 'https://example.com/a' } },
      'up-1',
    );
    expect(body).toMatchObject({
      linkType: 'URL',
      linkTarget: 'https://example.com/a',
      imageUploadId: 'up-1',
    });
    expect(Object.keys(body)).not.toContain('imageUrl');
  });
});

describe('audienceFields', () => {
  it('sends the account list alone for ACCOUNT_IDS, even if platforms and languages were chosen before', () => {
    const fields = audienceFields({
      audience: 'ACCOUNT_IDS',
      accountIdsText: 'a1\nb2',
      platforms: ['IOS'],
      locales: ['th'],
    });
    expect(fields).toEqual({ audience: 'ACCOUNT_IDS', accountIds: ['a1', 'b2'] });
  });

  it('sends the filters that are set for the other audiences, and no account list', () => {
    expect(
      audienceFields({
        audience: 'GUESTS',
        accountIdsText: 'a1',
        platforms: ['ANDROID'],
        locales: ['ar', 'vi'],
      }),
    ).toEqual({ audience: 'GUESTS', platforms: ['ANDROID'], locales: ['ar', 'vi'] });
    expect(
      audienceFields({ audience: 'ALL', accountIdsText: '', platforms: [], locales: [] }),
    ).toEqual({
      audience: 'ALL',
    });
  });
});

describe('pickedInstantUtc', () => {
  it('reads the clock fields of the picker as UTC, whatever the zone of the browser', () => {
    expect(pickedInstantUtc(dayjs('2026-11-03T21:45:00'))).toBe('2026-11-03T21:45:00.000Z');
    expect(pickedInstantUtc(dayjs('2026-01-01T00:00:59'))).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('scheduleFields', () => {
  const content = { title: 't', body: 'b', link: { linkType: 'NONE' as const, linkTarget: '' } };
  const when = {
    timeOfDay: '09:05',
    timezone: 'Asia/Bangkok',
    startDate: '2026-11-01',
    endDate: null,
    enabled: true,
  };
  const who = { audience: 'ALL' as const, accountIdsText: '', platforms: [], locales: [] };

  it('weekly: sends the days and no day of the month', () => {
    const f = scheduleFields({
      ...content,
      ...who,
      ...when,
      repeat: 'WEEKLY',
      daysOfWeek: [5, 1],
      dayOfMonth: 31,
    });
    expect(f.repeat).toBe('WEEKLY');
    expect(f.daysOfWeek).toEqual([1, 5]);
    expect('dayOfMonth' in f).toBe(false);
  });

  it('monthly: sends the day and no weekdays', () => {
    const f = scheduleFields({
      ...content,
      ...who,
      ...when,
      repeat: 'MONTHLY',
      daysOfWeek: [1],
      dayOfMonth: 31,
    });
    expect(f.dayOfMonth).toBe(31);
    expect('daysOfWeek' in f).toBe(false);
  });

  it('daily: sends neither, and keeps a null end date as null', () => {
    const f = scheduleFields({
      ...content,
      ...who,
      ...when,
      repeat: 'DAILY',
      daysOfWeek: [1],
      dayOfMonth: 3,
    });
    expect('daysOfWeek' in f).toBe(false);
    expect('dayOfMonth' in f).toBe(false);
    expect(f.endDate).toBeNull();
    expect(f.timezone).toBe('Asia/Bangkok');
  });
});

describe('scheduleToValues (a row becomes the form again, for the switch in the list)', () => {
  const row: PushSchedule = {
    id: '9',
    createdBy: '1',
    createdByUsername: 'root',
    repeat: 'WEEKLY',
    daysOfWeek: [2, 4],
    dayOfMonth: null,
    timeOfDay: '20:30',
    timezone: 'Asia/Bangkok',
    startDate: '2026-09-15',
    endDate: null,
    enabled: true,
    nextRunAt: '2026-11-03T13:30:00.000Z',
    audience: 'ACCOUNT_IDS',
    accountIds: ['a1', 'b2'],
    platforms: null,
    locales: null,
    title: 'สวัสดี',
    body: 'مرحبا',
    linkType: 'SCREEN',
    linkTarget: 'store',
    imageUrl: 'https://example.com/i.png',
  };

  it('gives the same body back with the other state, and no picture field', () => {
    const body = scheduleFields({ ...scheduleToValues(row), enabled: false });
    expect(body).toEqual({
      repeat: 'WEEKLY',
      daysOfWeek: [2, 4],
      timeOfDay: '20:30',
      timezone: 'Asia/Bangkok',
      startDate: '2026-09-15',
      endDate: null,
      enabled: false,
      audience: 'ACCOUNT_IDS',
      accountIds: ['a1', 'b2'],
      title: 'สวัสดี',
      body: 'مرحبا',
      linkType: 'SCREEN',
      linkTarget: 'store',
    });
  });

  it('survives missing arrays and null text of a row from the backend', () => {
    const values = scheduleToValues({
      ...row,
      audience: 'ALL',
      accountIds: null,
      platforms: null,
      locales: null,
      daysOfWeek: null,
      linkTarget: null,
      title: null as unknown as string,
    });
    expect(values.platforms).toEqual([]);
    expect(values.locales).toEqual([]);
    expect(values.title).toBe('');
    expect(values.link).toEqual({ linkType: 'SCREEN', linkTarget: '' });
  });
});

describe('timeZoneNames', () => {
  it('starts with UTC, has a name for Bangkok and Mexico City, and no name twice', () => {
    const names = timeZoneNames();
    expect(names[0]).toBe('UTC');
    expect(names).toContain('Asia/Bangkok');
    expect(names).toContain('America/Mexico_City');
    expect(new Set(names).size).toBe(names.length);
  });

  it('puts a zone that the list lacks (a saved one) in front of the rest', () => {
    expect(timeZoneNames('Etc/Unknown-Zone')[1]).toBe('Etc/Unknown-Zone');
  });
});
