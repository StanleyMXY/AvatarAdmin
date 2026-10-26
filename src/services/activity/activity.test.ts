import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  confirmActivityOverlap,
  createCheckinActivity,
  createTaskConfig,
  deleteCheckinActivity,
  deleteTaskConfig,
  getCheckinActivity,
  listCheckinActivities,
  listCheckinRecords,
  listTaskConfigs,
  listTaskRecords,
  probeActivityOverlap,
  setCheckinActivityStatus,
  setTaskConfigStatus,
  updateCheckinActivity,
  updateTaskConfig,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

const ACTIVITY_BODY = {
  name: 'Autumn',
  startDate: '2026-11-01',
  endDate: null,
  rewards: [{ dayNum: 1, rewardCredits: 2, bonusCredits: 0 }],
};

describe('the sign-in activities', () => {
  it('lists with the paging and the filters, and leaves empty filters out', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCheckinActivities({
      page: 2,
      pageSize: 50,
      name: 'ฤดู',
      lifecycleStatus: 'ENDED',
    });
    await listCheckinActivities({ page: 1, pageSize: 20, name: '' });
    const first = new URL(calls[0].url, 'http://x');
    expect(first.pathname).toBe('/api/admin/checkin/activities');
    expect(Object.fromEntries(first.searchParams)).toEqual({
      page: '2',
      pageSize: '50',
      name: 'ฤดู',
      lifecycleStatus: 'ENDED',
    });
    expect(calls[1].url).toBe('/api/admin/checkin/activities?page=1&pageSize=20');
  });

  it('reads one activity with its steps by id', async () => {
    const calls = answer({ id: 'a/1', rewards: [] });
    await getCheckinActivity('a/1');
    expect(calls[0].url).toBe('/api/admin/checkin/activities/a%2F1');
    expect(calls[0].init.method).toBe('GET');
  });

  it('creates, updates (without confirm) and deletes by id', async () => {
    const calls = answer({ id: '7' });
    await createCheckinActivity(ACTIVITY_BODY);
    expect(calls[0].url).toBe('/api/admin/checkin/activities');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual(ACTIVITY_BODY);
    await updateCheckinActivity('7', ACTIVITY_BODY);
    expect(calls[1].url).toBe('/api/admin/checkin/activities/7');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual(ACTIVITY_BODY);
    expect(body(calls[1])).not.toHaveProperty('confirm');
    await deleteCheckinActivity('7');
    expect(calls[2].url).toBe('/api/admin/checkin/activities/7');
    expect(calls[2].init.method).toBe('DELETE');
  });

  it('stops an activity with the status call and no confirm', async () => {
    const calls = answer({ id: '7' });
    await setCheckinActivityStatus('7', 'DISABLED');
    expect(calls[0].url).toBe('/api/admin/checkin/activities/7/status');
    expect(calls[0].init.method).toBe('PUT');
    expect(body(calls[0])).toEqual({ status: 'DISABLED' });
  });
});

describe('probeActivityOverlap', () => {
  it('publishing and enabling ask with confirm=false first and return the activities that would be stopped', async () => {
    for (const action of ['publish', 'enable'] as const) {
      const calls = answer({
        applied: false,
        disabledActivities: [{ id: '3', name: 'Old one' }],
      });
      const result = await probeActivityOverlap(action, '7');
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('/api/admin/checkin/activities/7/status');
      expect(calls[0].init.method).toBe('PUT');
      expect(body(calls[0])).toEqual({ status: 'ACTIVE', confirm: false });
      expect(result).toEqual([{ id: '3', name: 'Old one' }]);
    }
  });

  it('returns null when the backend did it without an overlap (no list, or an empty one)', async () => {
    answer({ id: '7', status: 'ACTIVE' });
    expect(await probeActivityOverlap('publish', '7')).toBeNull();
    answer({ applied: true, disabledActivities: [] });
    expect(await probeActivityOverlap('enable', '7')).toBeNull();
  });

  it('an answer with applied false and no names still means it was not done', async () => {
    answer({ applied: false });
    expect(await probeActivityOverlap('enable', '7')).toEqual([]);
  });

  it('editing the date range sends the whole body with confirm=false to the activity itself', async () => {
    const calls = answer({ applied: false, disabledActivities: [{ id: '5', name: 'Other' }] });
    const result = await probeActivityOverlap('update', '7', ACTIVITY_BODY);
    expect(calls[0].url).toBe('/api/admin/checkin/activities/7');
    expect(calls[0].init.method).toBe('PUT');
    expect(body(calls[0])).toEqual({ ...ACTIVITY_BODY, confirm: false });
    expect(result).toEqual([{ id: '5', name: 'Other' }]);
  });

  it('a failed probe rejects, so the page can show the failure', async () => {
    stubFetch(() => jsonResponse(409, envelope('INVALID_STATE', { status: 'ACTIVE' })));
    await expect(probeActivityOverlap('publish', '7')).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });

  it('confirmActivityOverlap sends the same request with confirm=true', async () => {
    const calls = answer({ id: '7' });
    await confirmActivityOverlap('publish', '7');
    expect(body(calls[0])).toEqual({ status: 'ACTIVE', confirm: true });
    await confirmActivityOverlap('update', '7', ACTIVITY_BODY);
    expect(calls[1].url).toBe('/api/admin/checkin/activities/7');
    expect(body(calls[1])).toEqual({ ...ACTIVITY_BODY, confirm: true });
  });
});

describe('the sign-in records', () => {
  it('lists with the account and activity filters', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCheckinRecords({ page: 1, pageSize: 20, accountId: 'acc-1', activityId: '4' });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/checkin/records');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      pageSize: '20',
      accountId: 'acc-1',
      activityId: '4',
    });
  });
});

const TASK_BODY = {
  taskName: 'Talk',
  taskType: 'call_seconds' as const,
  targetValue: 600,
  rewardCredits: 3,
  description: 'x',
  claimTimeoutSeconds: null,
  sortOrder: 0,
};

describe('the task configurations', () => {
  it('lists with the filters', async () => {
    const calls = answer({ items: [], total: 0 });
    await listTaskConfigs({
      page: 1,
      pageSize: 20,
      taskName: 'مهمة',
      taskType: 'daily_login',
      status: 'DISABLED',
    });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/tasks/configs');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      pageSize: '20',
      taskName: 'مهمة',
      taskType: 'daily_login',
      status: 'DISABLED',
    });
  });

  it('creates, updates, deletes and switches by id', async () => {
    const calls = answer({ id: '9' });
    await createTaskConfig(TASK_BODY);
    expect(calls[0].url).toBe('/api/admin/tasks/configs');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual(TASK_BODY);
    await updateTaskConfig('9', TASK_BODY);
    expect(calls[1].url).toBe('/api/admin/tasks/configs/9');
    expect(calls[1].init.method).toBe('PUT');
    await deleteTaskConfig('9');
    expect(calls[2].url).toBe('/api/admin/tasks/configs/9');
    expect(calls[2].init.method).toBe('DELETE');
    await setTaskConfigStatus('9', 'DISABLED');
    expect(calls[3].url).toBe('/api/admin/tasks/configs/9/status');
    expect(calls[3].init.method).toBe('PUT');
    expect(body(calls[3])).toEqual({ status: 'DISABLED' });
  });

  it('a delete refused with TASK_HAS_RECORDS rejects with that code', async () => {
    stubFetch(() => jsonResponse(409, envelope('TASK_HAS_RECORDS')));
    await expect(deleteTaskConfig('9')).rejects.toMatchObject({ code: 'TASK_HAS_RECORDS' });
  });
});

describe('the task records', () => {
  it('lists with the account and status filters', async () => {
    const calls = answer({ items: [], total: 0 });
    await listTaskRecords({ page: 3, pageSize: 10, accountId: 'acc-9', status: 'CLAIMABLE' });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/tasks/records');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '3',
      pageSize: '10',
      accountId: 'acc-9',
      status: 'CLAIMABLE',
    });
  });
});
