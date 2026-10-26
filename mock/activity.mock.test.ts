import { beforeEach, describe, expect, it } from 'vitest';
import {
  activityState,
  lifecycleOf,
  rangesOverlap,
  resetActivityStore,
} from './_core/activityData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import activity from './activity.mock';

beforeEach(() => {
  resetStore();
  resetActivityStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (activity as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const ACTIVITIES = 'GET /api/admin/checkin/activities';
const ACTIVITY = 'GET /api/admin/checkin/activities/:id';
const CREATE = 'POST /api/admin/checkin/activities';
const UPDATE = 'PUT /api/admin/checkin/activities/:id';
const DELETE = 'DELETE /api/admin/checkin/activities/:id';
const STATUS = 'PUT /api/admin/checkin/activities/:id/status';
const RECORDS = 'GET /api/admin/checkin/records';
const CONFIGS = 'GET /api/admin/tasks/configs';
const CONFIG_CREATE = 'POST /api/admin/tasks/configs';
const CONFIG_UPDATE = 'PUT /api/admin/tasks/configs/:id';
const CONFIG_DELETE = 'DELETE /api/admin/tasks/configs/:id';
const CONFIG_STATUS = 'PUT /api/admin/tasks/configs/:id/status';
const TASK_RECORDS = 'GET /api/admin/tasks/records';

const body = (over: Record<string, unknown> = {}) => ({
  name: 'Winter',
  startDate: '2027-02-01',
  endDate: '2027-02-28',
  rewards: [
    { dayNum: 1, rewardCredits: 1, bonusCredits: 0 },
    { dayNum: 2, rewardCredits: 2, bonusCredits: 1 },
  ],
  ...over,
});

const task = (over: Record<string, unknown> = {}) => ({
  taskName: 'Chat',
  taskType: 'text_messages',
  targetValue: 10,
  rewardCredits: 2,
  description: 'Send ten messages',
  claimTimeoutSeconds: null,
  sortOrder: 0,
  ...over,
});

const refs = (reply: { body: { data: { details?: { ref: string }[] } } }) =>
  reply.body.data.details?.map((d) => d.ref);

describe('the permissions', () => {
  it('refuses a request without a token with 401', async () => {
    const reply = await call(h(ACTIVITIES), {});
    expect(reply.status).toBe(401);
  });

  it('needs CHECKIN:VIEW to read, CHECKIN:MANAGE to write, TASK:VIEW and TASK:MANAGE for the tasks', async () => {
    // `finance` holds none of the four codes.
    for (const [name, write] of [
      [ACTIVITIES, false],
      [RECORDS, false],
      [CONFIGS, false],
      [TASK_RECORDS, false],
      [CREATE, true],
      [CONFIG_CREATE, true],
    ] as const) {
      const reply = write
        ? await send(name, {}, {}, 'finance')
        : await get(name, {}, {}, 'finance');
      expect(reply.status, name).toBe(403);
      expect(reply.body.code, name).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('lets an administrator with only the view code read but not write', async () => {
    const admin = adminOf('finance');
    admin.permissions = ['CHECKIN:VIEW', 'TASK:VIEW'];
    expect((await get(ACTIVITIES, {}, {}, 'finance')).status).toBe(200);
    expect((await get(CONFIGS, {}, {}, 'finance')).status).toBe(200);
    expect((await send(CREATE, body(), {}, 'finance')).status).toBe(403);
    expect((await send(CONFIG_CREATE, task(), {}, 'finance')).status).toBe(403);
    expect((await send(STATUS, { status: 'DISABLED' }, { id: '1' }, 'finance')).status).toBe(403);
  });
});

describe('the sign-in activity list', () => {
  it('answers items and total with the columns of the activity, the name of the creator and the lifecycle state', async () => {
    const reply = await get(ACTIVITIES, { page: '1', pageSize: '3' });
    expect(reply.status).toBe(200);
    expect(reply.body.data.total).toBe(activityState.activities.length);
    expect(reply.body.data.items).toHaveLength(3);
    const first = reply.body.data.items[0];
    expect(Object.keys(first).sort()).toEqual(
      [
        'id',
        'name',
        'startDate',
        'endDate',
        'status',
        'createdBy',
        'createdByUsername',
        'lifecycleStatus',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(first).not.toHaveProperty('rewards');
  });

  it('shows a live activity whose last day has passed as ENDED, and the name of a deleted creator as null', async () => {
    const all = (await get(ACTIVITIES, { pageSize: '50' })).body.data.items;
    const byId = (id: string) => all.find((a: { id: string }) => a.id === id);
    expect(byId('2')).toMatchObject({ status: 'ACTIVE', lifecycleStatus: 'ENDED' });
    expect(byId('1')).toMatchObject({ status: 'ACTIVE', lifecycleStatus: 'ACTIVE' });
    expect(byId('3')).toMatchObject({ createdBy: '9999', createdByUsername: null });
    expect(byId('1').createdByUsername).toBe('root');
  });

  it('filters by name (a part, in any case) and by lifecycle state', async () => {
    const byName = await get(ACTIVITIES, { name: 'AUTUMN' });
    expect(byName.body.data.items.map((a: { id: string }) => a.id)).toEqual(['1']);
    const ended = await get(ACTIVITIES, { lifecycleStatus: 'ENDED' });
    expect(ended.body.data.items.map((a: { id: string }) => a.id)).toEqual(['2']);
    const drafts = await get(ACTIVITIES, { lifecycleStatus: 'DRAFT' });
    expect(drafts.body.data.items.every((a: { status: string }) => a.status === 'DRAFT')).toBe(
      true,
    );
  });

  it('refuses a state that does not exist and a page outside the range with 400 and the name of the parameter', async () => {
    const state = await get(ACTIVITIES, { lifecycleStatus: 'LIVE' });
    expect(state.status).toBe(400);
    expect(refs(state)).toEqual(['lifecycleStatus']);
    const page = await get(ACTIVITIES, { page: '0', pageSize: '500' });
    expect(page.status).toBe(400);
    expect(refs(page)).toEqual(['page', 'pageSize']);
  });
});

describe('one sign-in activity', () => {
  it('has the steps by day number, without the activity id, and 404 when there is no such activity', async () => {
    const reply = await get(ACTIVITY, {}, { id: '1' });
    expect(reply.body.data.rewards.map((r: { dayNum: number }) => r.dayNum)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(reply.body.data.rewards[0]).toEqual({ dayNum: 1, rewardCredits: 1, bonusCredits: 0 });
    expect(reply.body.data.rewards[6].bonusCredits).toBe(2);
    const missing = await get(ACTIVITY, {}, { id: '404' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('creating a sign-in activity', () => {
  it('makes a draft with the name trimmed, and the list shows it', async () => {
    const reply = await send(CREATE, body({ name: `  Winter${String.fromCharCode(0xa0)}` }));
    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({
      name: 'Winter',
      status: 'DRAFT',
      lifecycleStatus: 'DRAFT',
      createdByUsername: 'root',
    });
    const read = await get(ACTIVITY, {}, { id: reply.body.data.id });
    expect(read.body.data.rewards).toHaveLength(2);
    const list = await get(ACTIVITIES, { name: 'winter' });
    expect(list.body.data.total).toBe(1);
  });

  it('accepts an activity without start and end day', async () => {
    const reply = await send(CREATE, body({ startDate: null, endDate: null }));
    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({ startDate: null, endDate: null });
  });

  it.each([
    ['an empty name', { name: ' ' }, 'name'],
    ['an end before the start', { startDate: '2027-03-01', endDate: '2027-02-01' }, 'endDate'],
    ['a day that is not a day', { startDate: '2027-02-30' }, 'startDate'],
    ['no steps', { rewards: [] }, 'rewards'],
    [
      'a gap in the day numbers',
      {
        rewards: [
          { dayNum: 1, rewardCredits: 1, bonusCredits: 0 },
          { dayNum: 3, rewardCredits: 1, bonusCredits: 0 },
        ],
      },
      'rewards',
    ],
    [
      'a negative reward',
      { rewards: [{ dayNum: 1, rewardCredits: -1, bonusCredits: 0 }] },
      'rewards',
    ],
    [
      'a reward that is not an integer',
      { rewards: [{ dayNum: 1, rewardCredits: 1.5, bonusCredits: 0 }] },
      'rewards',
    ],
    [
      'a negative bonus',
      { rewards: [{ dayNum: 1, rewardCredits: 1, bonusCredits: -1 }] },
      'rewards',
    ],
  ])('refuses %s with 400 INVALID_REQUEST', async (_label, over, ref) => {
    const reply = await send(CREATE, body(over));
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe('INVALID_REQUEST');
    expect(refs(reply)).toContain(ref);
    expect(activityState.activities).toHaveLength(7);
  });

  it('takes a missing bonus as 0', async () => {
    const reply = await send(CREATE, body({ rewards: [{ dayNum: 1, rewardCredits: 4 }] }));
    expect(reply.status).toBe(200);
    const read = await get(ACTIVITY, {}, { id: reply.body.data.id });
    expect(read.body.data.rewards).toEqual([{ dayNum: 1, rewardCredits: 4, bonusCredits: 0 }]);
  });
});

describe('publishing and enabling (the probe)', () => {
  it('publishing a draft that overlaps the live activity does nothing with confirm=false and names the activity', async () => {
    const reply = await send(STATUS, { status: 'ACTIVE', confirm: false }, { id: '5' });
    expect(reply.status).toBe(200);
    expect(reply.body.data).toEqual({
      applied: false,
      disabledActivities: [{ id: '1', name: 'Autumn check-in 🍂' }],
    });
    expect(activityState.activities.find((a) => a.id === '5')?.status).toBe('DRAFT');
    expect(activityState.activities.find((a) => a.id === '1')?.status).toBe('ACTIVE');
  });

  it('with confirm=true it publishes and stops the activity that overlaps', async () => {
    const reply = await send(STATUS, { status: 'ACTIVE', confirm: true }, { id: '5' });
    expect(reply.status).toBe(200);
    expect(activityState.activities.find((a) => a.id === '5')?.status).toBe('ACTIVE');
    expect(activityState.activities.find((a) => a.id === '1')?.status).toBe('DISABLED');
  });

  it('a draft that overlaps nothing is published at once, whatever confirm says', async () => {
    for (const confirm of [false, true, undefined]) {
      resetActivityStore();
      const reply = await send(STATUS, { status: 'ACTIVE', confirm }, { id: '3' });
      expect(reply.status).toBe(200);
      expect(reply.body.data).not.toHaveProperty('disabledActivities');
      expect(activityState.activities.find((a) => a.id === '3')?.status).toBe('ACTIVE');
    }
  });

  it('enabling a stopped activity is probed the same way; an activity stored as live whose days have passed is stopped too', async () => {
    const probe = await send(STATUS, { status: 'ACTIVE', confirm: false }, { id: '6' });
    expect(probe.body.data.applied).toBe(false);
    expect(probe.body.data.disabledActivities.map((a: { id: string }) => a.id)).toEqual(['1', '2']);
    const enabled = await send(STATUS, { status: 'ACTIVE', confirm: true }, { id: '6' });
    expect(enabled.status).toBe(200);
    expect(activityState.activities.filter((a) => a.status === 'ACTIVE').map((a) => a.id)).toEqual([
      '6',
    ]);
  });

  it('stops a live activity without a probe', async () => {
    const reply = await send(STATUS, { status: 'DISABLED' }, { id: '1' });
    expect(reply.status).toBe(200);
    expect(activityState.activities.find((a) => a.id === '1')?.status).toBe('DISABLED');
  });

  it('refuses a change the state does not allow with 409 INVALID_STATE and the current state', async () => {
    const live = await send(STATUS, { status: 'ACTIVE', confirm: true }, { id: '1' });
    expect(live.status).toBe(409);
    expect(live.body.code).toBe('INVALID_STATE');
    expect(live.body.data).toEqual({ status: 'ACTIVE' });
    const draft = await send(STATUS, { status: 'DISABLED' }, { id: '3' });
    expect(draft.status).toBe(409);
    expect(draft.body.data).toEqual({ status: 'DRAFT' });
  });

  it('answers 404 for an activity that does not exist and 400 for a state that does not exist', async () => {
    expect((await send(STATUS, { status: 'ACTIVE' }, { id: '404' })).status).toBe(404);
    const bad = await send(STATUS, { status: 'DRAFT' }, { id: '3' });
    expect(bad.status).toBe(400);
    expect(refs(bad)).toEqual(['status']);
  });
});

describe('editing a sign-in activity', () => {
  it('edits a draft at once and replaces the steps', async () => {
    const reply = await send(UPDATE, body({ name: 'Renamed' }), { id: '3' });
    expect(reply.status).toBe(200);
    const read = await get(ACTIVITY, {}, { id: '3' });
    expect(read.body.data.name).toBe('Renamed');
    expect(read.body.data.rewards).toHaveLength(2);
  });

  it('moving the range of the live activity onto another live one is probed: nothing is done with confirm=false', async () => {
    await send(STATUS, { status: 'ACTIVE', confirm: true }, { id: '3' });
    const reply = await send(
      UPDATE,
      { ...body({ startDate: '2026-01-01', endDate: null }), confirm: false },
      { id: '1' },
    );
    expect(reply.status).toBe(200);
    expect(reply.body.data.applied).toBe(false);
    expect(reply.body.data.disabledActivities.length).toBeGreaterThan(0);
    expect(activityState.activities.find((a) => a.id === '1')?.name).toBe('Autumn check-in 🍂');
  });

  it('with confirm=true it is done and what overlaps is stopped', async () => {
    await send(STATUS, { status: 'ACTIVE', confirm: true }, { id: '3' });
    const reply = await send(
      UPDATE,
      { ...body({ name: 'Wide', startDate: '2026-01-01', endDate: null }), confirm: true },
      { id: '1' },
    );
    expect(reply.status).toBe(200);
    expect(activityState.activities.find((a) => a.id === '1')?.name).toBe('Wide');
    expect(activityState.activities.find((a) => a.id === '3')?.status).toBe('DISABLED');
  });

  it('changing the name of a live activity without touching the range is done at once', async () => {
    const live = activityState.activities.find((a) => a.id === '1');
    const reply = await send(
      UPDATE,
      body({ name: 'Same days', startDate: live?.startDate, endDate: live?.endDate }),
      { id: '1' },
    );
    expect(reply.status).toBe(200);
    expect(reply.body.data).not.toHaveProperty('disabledActivities');
    expect(activityState.activities.find((a) => a.id === '1')?.name).toBe('Same days');
  });

  it('answers 404 for an activity that does not exist', async () => {
    expect((await send(UPDATE, body(), { id: '404' })).status).toBe(404);
  });
});

describe('deleting a sign-in activity', () => {
  it('deletes a draft without records', async () => {
    const reply = await send(DELETE, undefined, { id: '3' });
    expect(reply.status).toBe(200);
    expect(activityState.activities.find((a) => a.id === '3')).toBeUndefined();
  });

  it('refuses an activity that is not a draft with 409 INVALID_STATE and its state', async () => {
    for (const [id, status] of [
      ['1', 'ACTIVE'],
      ['4', 'DISABLED'],
    ]) {
      const reply = await send(DELETE, undefined, { id });
      expect(reply.status).toBe(409);
      expect(reply.body.code).toBe('INVALID_STATE');
      expect(reply.body.data).toEqual({ status });
    }
    expect(activityState.activities).toHaveLength(7);
  });

  it('refuses a draft that has sign-in records, and answers 404 for one that does not exist', async () => {
    activityState.checkinRecords.push({ ...activityState.checkinRecords[0], activityId: '3' });
    expect((await send(DELETE, undefined, { id: '3' })).status).toBe(409);
    expect((await send(DELETE, undefined, { id: '404' })).status).toBe(404);
  });
});

describe('the sign-in records', () => {
  it('has the columns of the record and the name of the activity, null with the id kept when the activity is gone', async () => {
    const reply = await get(RECORDS, { pageSize: '100' });
    expect(reply.body.data.total).toBe(45);
    const known = reply.body.data.items.find((r: { activityId: string }) => r.activityId === '1');
    expect(known.activityName).toBe('Autumn check-in 🍂');
    expect(Object.keys(known).sort()).toEqual(
      [
        'id',
        'accountId',
        'activityId',
        'activityName',
        'checkinDate',
        'dayNum',
        'consecutiveDays',
        'rewardCredits',
        'bonusCredits',
        'createdAt',
      ].sort(),
    );
    const gone = reply.body.data.items.find((r: { activityId: string }) => r.activityId === '99');
    expect(gone.activityName).toBeNull();
  });

  it('filters by account and by activity, and pages', async () => {
    const account = activityState.checkinRecords[0].accountId;
    const byAccount = await get(RECORDS, { accountId: account, pageSize: '100' });
    expect(byAccount.body.data.items.length).toBeGreaterThan(0);
    expect(
      byAccount.body.data.items.every((r: { accountId: string }) => r.accountId === account),
    ).toBe(true);
    const byActivity = await get(RECORDS, { activityId: '2', pageSize: '100' });
    expect(byActivity.body.data.total).toBe(12);
    const paged = await get(RECORDS, { page: '2', pageSize: '10' });
    expect(paged.body.data.items).toHaveLength(10);
    expect(paged.body.data.total).toBe(45);
  });
});

describe('the task configurations', () => {
  it('lists them by sort order with the columns of the configuration and filters by name, type and state', async () => {
    const reply = await get(CONFIGS, { pageSize: '50' });
    expect(reply.body.data.total).toBe(6);
    expect(reply.body.data.items.map((c: { id: string }) => c.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(Object.keys(reply.body.data.items[0]).sort()).toEqual(
      [
        'id',
        'taskName',
        'taskType',
        'targetValue',
        'rewardCredits',
        'description',
        'claimTimeoutSeconds',
        'sortOrder',
        'status',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect((await get(CONFIGS, { taskName: 'OPEN THE' })).body.data.total).toBe(1);
    expect((await get(CONFIGS, { taskType: 'call_seconds' })).body.data.total).toBe(2);
    expect((await get(CONFIGS, { status: 'DISABLED' })).body.data.total).toBe(2);
    expect((await get(CONFIGS, { taskType: 'watch' })).status).toBe(400);
    expect((await get(CONFIGS, { status: 'x' })).status).toBe(400);
  });

  it('creates an enabled configuration with the text trimmed, and the list shows it', async () => {
    const reply = await send(
      CONFIG_CREATE,
      task({ taskName: ' Chat ', description: `${String.fromCharCode(0x3000)}hi ` }),
    );
    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({
      taskName: 'Chat',
      description: 'hi',
      status: 'ENABLED',
    });
    expect((await get(CONFIGS, { pageSize: '50' })).body.data.total).toBe(7);
  });

  it.each([
    ['an empty name', { taskName: '' }, 'taskName'],
    ['a name of 101 code points', { taskName: '😀'.repeat(101) }, 'taskName'],
    ['a type that does not exist', { taskType: 'watch_episodes' }, 'taskType'],
    ['a target of 0', { targetValue: 0 }, 'targetValue'],
    ['a target that is not an integer', { targetValue: 1.5 }, 'targetValue'],
    [
      'a login task with a target other than 1',
      { taskType: 'daily_login', targetValue: 2 },
      'targetValue',
    ],
    ['a negative reward', { rewardCredits: -1 }, 'rewardCredits'],
    ['a description of 501 code points', { description: '😀'.repeat(501) }, 'description'],
    ['a claim time of 0 seconds', { claimTimeoutSeconds: 0 }, 'claimTimeoutSeconds'],
  ])('refuses %s with 400 INVALID_REQUEST', async (_label, over, ref) => {
    const reply = await send(CONFIG_CREATE, task(over));
    expect(reply.status).toBe(400);
    expect(refs(reply)).toContain(ref);
    expect(activityState.taskConfigs).toHaveLength(6);
  });

  it('accepts a description of exactly 500 code points (emoji count once each) and a reward of 0', async () => {
    const reply = await send(
      CONFIG_CREATE,
      task({ description: '😀'.repeat(500), rewardCredits: 0 }),
    );
    expect(reply.status).toBe(200);
  });

  it('accepts a login task with the target 1', async () => {
    expect(
      (await send(CONFIG_CREATE, task({ taskType: 'daily_login', targetValue: 1 }))).status,
    ).toBe(200);
  });

  it('changes the name, reward and others of a configuration that has records, but not the type or target (409 TASK_HAS_RECORDS)', async () => {
    const ok = await send(
      CONFIG_UPDATE,
      task({ taskName: 'Renamed', taskType: 'call_seconds', targetValue: 600, rewardCredits: 9 }),
      { id: '2' },
    );
    expect(ok.status).toBe(200);
    expect(activityState.taskConfigs.find((c) => c.id === '2')).toMatchObject({
      taskName: 'Renamed',
      rewardCredits: 9,
    });
    const type = await send(CONFIG_UPDATE, task({ taskType: 'text_messages', targetValue: 600 }), {
      id: '2',
    });
    expect(type.status).toBe(409);
    expect(type.body.code).toBe('TASK_HAS_RECORDS');
    const target = await send(CONFIG_UPDATE, task({ taskType: 'call_seconds', targetValue: 601 }), {
      id: '2',
    });
    expect(target.status).toBe(409);
    expect(activityState.taskConfigs.find((c) => c.id === '2')?.targetValue).toBe(600);
  });

  it('changes the type and target of a configuration without records', async () => {
    const reply = await send(CONFIG_UPDATE, task({ taskType: 'call_seconds', targetValue: 90 }), {
      id: '5',
    });
    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({ taskType: 'call_seconds', targetValue: 90 });
  });

  it('answers 404 for a configuration that does not exist', async () => {
    expect((await send(CONFIG_UPDATE, task(), { id: '404' })).status).toBe(404);
    expect((await send(CONFIG_DELETE, undefined, { id: '404' })).status).toBe(404);
    expect((await send(CONFIG_STATUS, { status: 'DISABLED' }, { id: '404' })).status).toBe(404);
  });

  it('deletes a configuration without records and refuses one with records (409 TASK_HAS_RECORDS)', async () => {
    const refused = await send(CONFIG_DELETE, undefined, { id: '1' });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('TASK_HAS_RECORDS');
    expect(activityState.taskConfigs).toHaveLength(6);
    const done = await send(CONFIG_DELETE, undefined, { id: '4' });
    expect(done.status).toBe(200);
    expect(activityState.taskConfigs).toHaveLength(5);
  });

  it('switches on and off, also for one that has records; a state that does not exist is 400', async () => {
    expect((await send(CONFIG_STATUS, { status: 'DISABLED' }, { id: '1' })).status).toBe(200);
    expect(activityState.taskConfigs.find((c) => c.id === '1')?.status).toBe('DISABLED');
    expect((await send(CONFIG_STATUS, { status: 'ENABLED' }, { id: '4' })).status).toBe(200);
    const bad = await send(CONFIG_STATUS, { status: 'PAUSED' }, { id: '1' });
    expect(bad.status).toBe(400);
    expect(refs(bad)).toEqual(['status']);
  });
});

describe('the task records', () => {
  it('has the columns of the record and the name of the task, null with the id kept when the task is gone', async () => {
    const reply = await get(TASK_RECORDS, { pageSize: '100' });
    expect(reply.body.data.total).toBe(48);
    const first = reply.body.data.items[0];
    expect(Object.keys(first).sort()).toEqual(
      [
        'id',
        'accountId',
        'taskId',
        'taskName',
        'taskDate',
        'currentProgress',
        'status',
        'timezone',
        'windowStartAt',
        'windowEndAt',
        'targetValue',
        'rewardCredits',
        'completedAt',
        'claimDeadlineAt',
        'rewardedAt',
        'creditsGranted',
        'createdAt',
      ].sort(),
    );
    const known = reply.body.data.items.find((r: { taskId: string }) => r.taskId === '1');
    expect(known.taskName).toBe('Open the app 📱');
    const gone = reply.body.data.items.find((r: { taskId: string }) => r.taskId === '99');
    expect(gone.taskName).toBeNull();
    expect(gone.taskId).toBe('99');
  });

  it('filters by account and status, and refuses a status that does not exist', async () => {
    const account = activityState.taskRecords[0].accountId;
    const byAccount = await get(TASK_RECORDS, { accountId: account, pageSize: '100' });
    expect(
      byAccount.body.data.items.every((r: { accountId: string }) => r.accountId === account),
    ).toBe(true);
    const claimable = await get(TASK_RECORDS, { status: 'CLAIMABLE', pageSize: '100' });
    expect(claimable.body.data.total).toBe(12);
    const bad = await get(TASK_RECORDS, { status: 'DONE' });
    expect(bad.status).toBe(400);
    expect(refs(bad)).toEqual(['status']);
  });

  it('has an unfinished record without a reached time and a rewarded one with the credits granted', async () => {
    const items = (await get(TASK_RECORDS, { pageSize: '100' })).body.data.items;
    const open = items.find((r: { status: string }) => r.status === 'IN_PROGRESS');
    expect(open.completedAt).toBeNull();
    expect(open.creditsGranted).toBeNull();
    const paid = items.find((r: { status: string }) => r.status === 'REWARDED');
    expect(paid.rewardedAt).not.toBeNull();
    expect(paid.creditsGranted).toBe(paid.rewardCredits);
  });
});

describe('the helpers of the sample data', () => {
  it('works out the end of a live activity from the last time zone on earth (UTC−12)', () => {
    const now = new Date('2026-10-26T10:00:00Z'); // it is still 25 October at UTC−12
    expect(lifecycleOf({ status: 'ACTIVE', endDate: '2026-10-25' }, now)).toBe('ACTIVE');
    expect(lifecycleOf({ status: 'ACTIVE', endDate: '2026-10-24' }, now)).toBe('ENDED');
    expect(lifecycleOf({ status: 'DISABLED', endDate: '2026-10-01' }, now)).toBe('DISABLED');
    expect(lifecycleOf({ status: 'ACTIVE', endDate: null }, now)).toBe('ACTIVE');
  });

  it('knows when ranges overlap; an empty start or end is no limit', () => {
    expect(
      rangesOverlap(
        { startDate: '2026-01-01', endDate: '2026-01-10' },
        { startDate: '2026-01-10', endDate: null },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { startDate: '2026-01-01', endDate: '2026-01-10' },
        { startDate: '2026-01-11', endDate: null },
      ),
    ).toBe(false);
    expect(
      rangesOverlap(
        { startDate: null, endDate: null },
        { startDate: '2030-01-01', endDate: '2030-01-02' },
      ),
    ).toBe(true);
  });

  it('puts the sample data back after a reset', async () => {
    await send(DELETE, undefined, { id: '3' });
    expect(activityState.activities).toHaveLength(6);
    resetActivityStore();
    expect(activityState.activities).toHaveLength(7);
  });
});
