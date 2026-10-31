import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  cancelTask,
  createSchedule,
  createTask,
  createTemplate,
  deleteSchedule,
  deleteTemplate,
  getRecord,
  listAllTemplates,
  listRecords,
  listSchedules,
  listTasks,
  listTemplates,
  updateSchedule,
  updateTemplate,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('the templates', () => {
  it('lists with the paging and creates, updates and deletes by id', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    expect(await listTemplates({ page: 2, pageSize: 50 })).toEqual({
      items: [{ id: '1' }],
      total: 1,
    });
    expect(calls[0].url).toBe('/api/admin/push/templates?page=2&pageSize=50');

    await createTemplate({
      triggerReason: 'daily_recall',
      locale: 'th',
      title: 't',
      body: 'b',
      linkType: 'NONE',
      linkTarget: '',
      enabled: false,
      imageUploadId: 'up-1',
    });
    expect(calls[1].url).toBe('/api/admin/push/templates');
    expect(calls[1].init.method).toBe('POST');
    expect(body(calls[1])).toMatchObject({
      triggerReason: 'daily_recall',
      locale: 'th',
      imageUploadId: 'up-1',
    });
    expect(body(calls[1])).not.toHaveProperty('imageUrl');

    await updateTemplate('7', {
      title: 'x',
      body: 'y',
      linkType: 'SCREEN',
      linkTarget: 'store',
      enabled: true,
    });
    expect(calls[2].url).toBe('/api/admin/push/templates/7');
    expect(calls[2].init.method).toBe('PUT');
    expect(body(calls[2])).toEqual({
      title: 'x',
      body: 'y',
      linkType: 'SCREEN',
      linkTarget: 'store',
      enabled: true,
    });

    await deleteTemplate('a/b');
    expect(calls[3].url).toBe('/api/admin/push/templates/a%2Fb');
    expect(calls[3].init.method).toBe('DELETE');
  });

  it('reads every page of the templates for the matrix, and stops when it has them all', async () => {
    const all = Array.from({ length: 450 }, (_, n) => ({ id: String(n) }));
    const calls = stubFetch((call) => {
      const page = Number(new URL(call.url, 'http://x').searchParams.get('page'));
      return jsonResponse(
        200,
        envelope('200', { items: all.slice((page - 1) * 200, page * 200), total: 450 }),
      );
    });
    const { items: rows } = await listAllTemplates();
    expect(rows).toHaveLength(450);
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/push/templates?page=1&pageSize=200',
      '/api/admin/push/templates?page=2&pageSize=200',
      '/api/admin/push/templates?page=3&pageSize=200',
    ]);
  });

  it('stops reading pages when a page comes back empty, so a wrong total cannot loop for ever', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [], total: 999 })));
    expect(await listAllTemplates()).toEqual({ items: [], missingLocales: null });
    expect(calls).toHaveLength(1);
  });

  it('keeps missingLocales of the answer next to the rows: the languages without an enabled template, for each recall reason', async () => {
    const missing = { daily_recall: ['th', 'ar'], streak_at_risk: ['en', 'th', 'ar'] };
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', { items: [{ id: '1' }], total: 1, missingLocales: missing }),
      ),
    );
    expect(await listAllTemplates()).toEqual({ items: [{ id: '1' }], missingLocales: missing });
    expect((await listTemplates({ page: 1, pageSize: 20 })).missingLocales).toEqual(missing);
  });

  it.each([
    ['is missing', undefined],
    ['is null', null],
    ['is a list', ['th']],
    ['is text', 'th'],
  ])(
    'takes missingLocales as unknown when it %s, and keeps only the reasons whose value is a list of texts',
    async (_name, value) => {
      stubFetch(() =>
        jsonResponse(200, envelope('200', { items: [], total: 0, missingLocales: value })),
      );
      expect((await listAllTemplates()).missingLocales).toBeNull();
      stubFetch(() =>
        jsonResponse(
          200,
          envelope('200', {
            items: [],
            total: 0,
            missingLocales: { daily_recall: ['th', 7, 'ar'], streak_at_risk: 'en', other: [] },
          }),
        ),
      );
      expect((await listAllTemplates()).missingLocales).toEqual({
        daily_recall: ['th', 'ar'],
        other: [],
      });
    },
  );
});

describe('the manual tasks', () => {
  it('lists, creates and cancels', async () => {
    const calls = answer({ items: [], total: 0 });
    await listTasks({ page: 1, pageSize: 20 });
    expect(calls[0].url).toBe('/api/admin/push/tasks?page=1&pageSize=20');
    await createTask({
      audience: 'ACCOUNT_IDS',
      accountIds: ['a1'],
      title: 't',
      body: 'b',
      linkType: 'URL',
      linkTarget: 'https://example.com/x',
    });
    expect(calls[1].init.method).toBe('POST');
    expect(calls[1].url).toBe('/api/admin/push/tasks');
    expect(body(calls[1])).not.toHaveProperty('platforms');
    await cancelTask('12');
    expect(calls[2].url).toBe('/api/admin/push/tasks/12/cancel');
    expect(calls[2].init.method).toBe('POST');
  });
});

describe('the schedules', () => {
  it('lists, creates, updates and deactivates by id', async () => {
    const calls = answer({ items: [], total: 0 });
    await listSchedules({ page: 1, pageSize: 20 });
    expect(calls[0].url).toBe('/api/admin/push/schedules?page=1&pageSize=20');
    const fields = {
      repeat: 'WEEKLY' as const,
      daysOfWeek: [1, 3],
      timeOfDay: '09:00',
      timezone: 'UTC',
      startDate: '2026-11-01',
      endDate: null,
      enabled: true,
      audience: 'ALL' as const,
      title: 't',
      body: 'b',
      linkType: 'NONE' as const,
      linkTarget: '',
    };
    await createSchedule(fields);
    expect(calls[1].url).toBe('/api/admin/push/schedules');
    expect(body(calls[1])).toMatchObject({ repeat: 'WEEKLY', daysOfWeek: [1, 3], endDate: null });
    await updateSchedule('5', { ...fields, enabled: false });
    expect(calls[2].url).toBe('/api/admin/push/schedules/5');
    expect(calls[2].init.method).toBe('PUT');
    await deleteSchedule('5');
    expect(calls[3].init.method).toBe('DELETE');
    expect(calls[3].url).toBe('/api/admin/push/schedules/5');
  });
});

describe('the records', () => {
  it('lists with the paging', async () => {
    const calls = answer({ items: [], total: 0 });
    await listRecords({ page: 3, pageSize: 10 });
    expect(calls[0].url).toBe('/api/admin/push/records?page=3&pageSize=10');
  });

  it('reads the deliveries of a record, whatever the list is called, and an empty list when there is none', async () => {
    answer({ id: '1', accountId: 'a', deliveries: [{ id: 'd1', result: 'ACCEPTED' }] });
    expect((await getRecord('1')).deliveries).toEqual([{ id: 'd1', result: 'ACCEPTED' }]);
    answer({ id: '1', items: [{ id: 'd2' }] });
    expect((await getRecord('1')).deliveries).toEqual([{ id: 'd2' }]);
    answer({ id: '1' });
    expect((await getRecord('1')).deliveries).toEqual([]);
  });
});
