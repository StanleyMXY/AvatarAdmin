// The activity endpoints of the mock backend (contract 28): sign-in activities with the probe that
// asks before two live activities would overlap, their records, daily task configurations and the
// task records. State lives in _core/activityData.ts. What the contract leaves open (the paging and
// filters of the lists, the answer of a change that was done) follows
// docs/contract-requests/2026-10-26-admin-frontend-activity.md. The statistics, the landing and the
// exports of the two reports are in stats.mock.ts and export.mock.ts.

import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import {
  activityState,
  lifecycleOf,
  type MockActivity,
  type MockReward,
  type MockTaskConfig,
  rangesOverlap,
  usernameOf,
} from './_core/activityData';
import { guard } from './_core/auth';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { validDay } from './_core/statRange';

type Detail = { ref: string; reason: string };

const LIFECYCLES = ['DRAFT', 'ACTIVE', 'ENDED', 'DISABLED'];
const TASK_TYPES = ['daily_login', 'call_seconds', 'text_messages'];
const TASK_STATUSES = ['ENABLED', 'DISABLED'];
const RECORD_STATUSES = ['IN_PROGRESS', 'CLAIMABLE', 'REWARDED', 'EXPIRED'];
const TASK_NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const queryText = (value: unknown): string => (isText(value) ? trimSpec(value) : '');

const fail = (details: Detail[]) =>
  invalidRequest(`invalid request: ${details.map((d) => d.ref).join(', ')}`, details);

const idOf = (req: { params: Record<string, string> }) => req.params.id ?? '';

/** An optional filter that has to be one of a list of values: 400 with the name of the parameter otherwise. */
function oneOfOrEmpty(value: unknown, ref: string, allowed: string[]): string {
  const text = queryText(value);
  if (text !== '' && !allowed.includes(text)) throw fail([{ ref, reason: 'OUT_OF_RANGE' }]);
  return text;
}

function dayFilter(req: { query: Record<string, unknown> }, ref: 'from' | 'to'): string {
  const text = queryText(req.query[ref]);
  if (text !== '' && !validDay(text)) throw fail([{ ref, reason: 'OUT_OF_RANGE' }]);
  return text;
}

// ---- sign-in activities ----

const activityOut = (a: MockActivity) => ({
  id: a.id,
  name: a.name,
  startDate: a.startDate,
  endDate: a.endDate,
  status: a.status,
  createdBy: a.createdBy,
  createdByUsername: usernameOf(a.createdBy),
  lifecycleStatus: lifecycleOf(a),
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

const detailOut = (a: MockActivity) => ({
  ...activityOut(a),
  rewards: [...a.rewards].sort((x, y) => x.dayNum - y.dayNum).map((r) => ({ ...r })),
});

const findActivity = (id: string): MockActivity => {
  const found = activityState.activities.find((a) => a.id === id);
  if (!found) throw notFound('activity');
  return found;
};

function dayOrNull(value: unknown, ref: string, details: Detail[]): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isText(value) || !validDay(value)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return null;
  }
  return value;
}

/** The checks of a new or edited activity (contract 28.1): the day numbers run from 1 in the order of the rows. */
function activityFields(body: Record<string, unknown>) {
  const details: Detail[] = [];
  const name = isText(body.name) ? trimSpec(body.name) : '';
  if (countCodePoints(name) === 0) details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
  const startDate = dayOrNull(body.startDate, 'startDate', details);
  const endDate = dayOrNull(body.endDate, 'endDate', details);
  if (startDate !== null && endDate !== null && startDate > endDate) {
    details.push({ ref: 'endDate', reason: 'OUT_OF_RANGE' });
  }
  const rewards: MockReward[] = [];
  const rows = body.rewards;
  if (!Array.isArray(rows) || rows.length === 0) {
    details.push({ ref: 'rewards', reason: 'EMPTY_NOT_ALLOWED' });
  } else {
    rows.forEach((row: Record<string, unknown> | null, i) => {
      const dayNum = row?.dayNum;
      const reward = row?.rewardCredits;
      const bonus = row?.bonusCredits === undefined ? 0 : row?.bonusCredits;
      if (dayNum !== i + 1) details.push({ ref: 'rewards', reason: 'OUT_OF_RANGE' });
      if (!isInt(reward)) details.push({ ref: 'rewards', reason: 'NOT_AN_INTEGER' });
      else if (reward < 0) details.push({ ref: 'rewards', reason: 'OUT_OF_RANGE' });
      if (!isInt(bonus)) details.push({ ref: 'rewards', reason: 'NOT_AN_INTEGER' });
      else if (bonus < 0) details.push({ ref: 'rewards', reason: 'OUT_OF_RANGE' });
      rewards.push({
        dayNum: i + 1,
        rewardCredits: isInt(reward) ? reward : 0,
        bonusCredits: isInt(bonus) ? bonus : 0,
      });
    });
  }
  if (body.confirm !== undefined && typeof body.confirm !== 'boolean') {
    details.push({ ref: 'confirm', reason: 'NOT_BOOLEAN' });
  }
  if (details.length > 0) throw fail(details);
  return { name, startDate, endDate, rewards };
}

/** The other live activities whose days overlap this range (by the stored state, as the contract says). */
const overlapping = (id: string, range: { startDate: string | null; endDate: string | null }) =>
  activityState.activities.filter(
    (other) => other.id !== id && other.status === 'ACTIVE' && rangesOverlap(other, range),
  );

const probeAnswer = (list: MockActivity[]) =>
  ok({
    applied: false,
    disabledActivities: list.map((other) => ({ id: other.id, name: other.name })),
  });

const stop = (list: MockActivity[], now: string) => {
  for (const other of list) {
    other.status = 'DISABLED';
    other.updatedAt = now;
  }
};

// ---- daily tasks ----

const configOut = (c: MockTaskConfig) => ({ ...c });

const findConfig = (id: string): MockTaskConfig => {
  const found = activityState.taskConfigs.find((c) => c.id === id);
  if (!found) throw notFound('task');
  return found;
};

const hasRecords = (taskId: string) => activityState.taskRecords.some((r) => r.taskId === taskId);

/** The checks of a new or edited task configuration (contract 28.2). */
function taskFields(body: Record<string, unknown>) {
  const details: Detail[] = [];
  const taskName = isText(body.taskName) ? trimSpec(body.taskName) : '';
  const nameLength = countCodePoints(taskName);
  if (nameLength === 0) details.push({ ref: 'taskName', reason: 'EMPTY_NOT_ALLOWED' });
  else if (nameLength > TASK_NAME_MAX) details.push({ ref: 'taskName', reason: 'TOO_LONG' });
  const taskType = body.taskType;
  if (!isText(taskType) || !TASK_TYPES.includes(taskType)) {
    details.push({ ref: 'taskType', reason: 'OUT_OF_RANGE' });
  }
  const target = body.targetValue;
  if (!isInt(target)) details.push({ ref: 'targetValue', reason: 'NOT_AN_INTEGER' });
  else if (target < 1 || (taskType === 'daily_login' && target !== 1)) {
    details.push({ ref: 'targetValue', reason: 'OUT_OF_RANGE' });
  }
  const reward = body.rewardCredits;
  if (!isInt(reward)) details.push({ ref: 'rewardCredits', reason: 'NOT_AN_INTEGER' });
  else if (reward < 0) details.push({ ref: 'rewardCredits', reason: 'OUT_OF_RANGE' });
  const description =
    body.description === undefined || body.description === null
      ? ''
      : isText(body.description)
        ? trimSpec(body.description)
        : null;
  if (description === null) details.push({ ref: 'description', reason: 'EMPTY_NOT_ALLOWED' });
  else if (countCodePoints(description) > DESCRIPTION_MAX) {
    details.push({ ref: 'description', reason: 'TOO_LONG' });
  }
  const claim = body.claimTimeoutSeconds ?? null;
  if (claim !== null && (!isInt(claim) || claim < 1)) {
    details.push({
      ref: 'claimTimeoutSeconds',
      reason: isInt(claim) ? 'OUT_OF_RANGE' : 'NOT_AN_INTEGER',
    });
  }
  const sortOrder = body.sortOrder === undefined ? 0 : body.sortOrder;
  if (!isInt(sortOrder)) details.push({ ref: 'sortOrder', reason: 'NOT_AN_INTEGER' });
  if (details.length > 0) throw fail(details);
  return {
    taskName,
    taskType: taskType as MockTaskConfig['taskType'],
    targetValue: target as number,
    rewardCredits: reward as number,
    description: description as string,
    claimTimeoutSeconds: claim as number | null,
    sortOrder: sortOrder as number,
  };
}

const byNewest = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id);

export default {
  // ---- sign-in activities (CHECKIN:VIEW / CHECKIN:MANAGE) ----
  'GET /api/admin/checkin/activities': guard('CHECKIN:VIEW', (req) => {
    const name = queryText(req.query.name).toLowerCase();
    const lifecycle = oneOfOrEmpty(req.query.lifecycleStatus, 'lifecycleStatus', LIFECYCLES);
    const rows = activityState.activities
      .filter((a) => name === '' || a.name.toLowerCase().includes(name))
      .filter((a) => lifecycle === '' || lifecycleOf(a) === lifecycle)
      .sort((a, b) => Number(b.id) - Number(a.id));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(activityOut), total: page.total });
  }),

  'GET /api/admin/checkin/activities/:id': guard('CHECKIN:VIEW', (req) =>
    ok(detailOut(findActivity(idOf(req)))),
  ),

  'POST /api/admin/checkin/activities': guard('CHECKIN:MANAGE', (req) => {
    const fields = activityFields(bodyOf(req));
    const now = new Date().toISOString();
    const created: MockActivity = {
      id: String(activityState.next.activity++),
      ...fields,
      status: 'DRAFT',
      createdBy: req.admin.id,
      createdAt: now,
      updatedAt: now,
    };
    activityState.activities.push(created);
    return ok(activityOut(created));
  }),

  'PUT /api/admin/checkin/activities/:id': guard('CHECKIN:MANAGE', (req) => {
    const target = findActivity(idOf(req));
    const body = bodyOf(req);
    const fields = activityFields(body);
    const rangeChanged = fields.startDate !== target.startDate || fields.endDate !== target.endDate;
    const now = new Date().toISOString();
    if (target.status === 'ACTIVE' && rangeChanged) {
      const clashes = overlapping(target.id, fields);
      if (clashes.length > 0) {
        if (body.confirm !== true) return probeAnswer(clashes);
        stop(clashes, now);
      }
    }
    Object.assign(target, fields, { updatedAt: now });
    return ok(activityOut(target));
  }),

  'DELETE /api/admin/checkin/activities/:id': guard('CHECKIN:MANAGE', (req) => {
    const target = findActivity(idOf(req));
    const used = activityState.checkinRecords.some((r) => r.activityId === target.id);
    if (target.status !== 'DRAFT' || used) {
      throw new MockHttpError(
        409,
        'INVALID_STATE',
        'Only a draft without sign-in records can be deleted',
        { status: target.status },
      );
    }
    activityState.activities = activityState.activities.filter((a) => a.id !== target.id);
    return ok(null);
  }),

  'PUT /api/admin/checkin/activities/:id/status': guard('CHECKIN:MANAGE', (req) => {
    const target = findActivity(idOf(req));
    const body = bodyOf(req);
    const status = body.status;
    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      throw fail([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    }
    if (body.confirm !== undefined && typeof body.confirm !== 'boolean') {
      throw fail([{ ref: 'confirm', reason: 'NOT_BOOLEAN' }]);
    }
    const allowedFrom = status === 'ACTIVE' ? ['DRAFT', 'DISABLED'] : ['ACTIVE'];
    if (!allowedFrom.includes(target.status)) {
      throw new MockHttpError(409, 'INVALID_STATE', 'The activity cannot move to that state', {
        status: target.status,
      });
    }
    const now = new Date().toISOString();
    if (status === 'ACTIVE') {
      const clashes = overlapping(target.id, target);
      if (clashes.length > 0) {
        if (body.confirm !== true) return probeAnswer(clashes);
        stop(clashes, now);
      }
    }
    target.status = status;
    target.updatedAt = now;
    return ok(activityOut(target));
  }),

  'GET /api/admin/checkin/records': guard('CHECKIN:VIEW', (req) => {
    const accountId = queryText(req.query.accountId);
    const activityId = queryText(req.query.activityId);
    const from = dayFilter(req, 'from');
    const to = dayFilter(req, 'to');
    const rows = activityState.checkinRecords
      .filter((r) => accountId === '' || r.accountId === accountId)
      .filter((r) => activityId === '' || r.activityId === activityId)
      .filter((r) => from === '' || r.checkinDate >= from)
      .filter((r) => to === '' || r.checkinDate <= to)
      .sort(byNewest);
    const page = paginateQuery(rows, req);
    return ok({
      items: page.items.map((r) => ({
        ...r,
        activityName: activityState.activities.find((a) => a.id === r.activityId)?.name ?? null,
      })),
      total: page.total,
    });
  }),

  // ---- daily tasks (TASK:VIEW / TASK:MANAGE) ----
  'GET /api/admin/tasks/configs': guard('TASK:VIEW', (req) => {
    const name = queryText(req.query.taskName).toLowerCase();
    const type = oneOfOrEmpty(req.query.taskType, 'taskType', TASK_TYPES);
    const status = oneOfOrEmpty(req.query.status, 'status', TASK_STATUSES);
    const rows = activityState.taskConfigs
      .filter((c) => name === '' || c.taskName.toLowerCase().includes(name))
      .filter((c) => type === '' || c.taskType === type)
      .filter((c) => status === '' || c.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(configOut), total: page.total });
  }),

  'POST /api/admin/tasks/configs': guard('TASK:MANAGE', (req) => {
    const fields = taskFields(bodyOf(req));
    const now = new Date().toISOString();
    const created: MockTaskConfig = {
      id: String(activityState.next.taskConfig++),
      ...fields,
      status: 'ENABLED',
      createdAt: now,
      updatedAt: now,
    };
    activityState.taskConfigs.push(created);
    return ok(configOut(created));
  }),

  'PUT /api/admin/tasks/configs/:id': guard('TASK:MANAGE', (req) => {
    const target = findConfig(idOf(req));
    const fields = taskFields(bodyOf(req));
    if (
      hasRecords(target.id) &&
      (fields.taskType !== target.taskType || fields.targetValue !== target.targetValue)
    ) {
      throw new MockHttpError(
        409,
        'TASK_HAS_RECORDS',
        'The task has records: stop it and make a new one instead',
      );
    }
    Object.assign(target, fields, { updatedAt: new Date().toISOString() });
    return ok(configOut(target));
  }),

  'DELETE /api/admin/tasks/configs/:id': guard('TASK:MANAGE', (req) => {
    const target = findConfig(idOf(req));
    if (hasRecords(target.id)) {
      throw new MockHttpError(
        409,
        'TASK_HAS_RECORDS',
        'The task has records: it can only be stopped',
      );
    }
    activityState.taskConfigs = activityState.taskConfigs.filter((c) => c.id !== target.id);
    return ok(null);
  }),

  'PUT /api/admin/tasks/configs/:id/status': guard('TASK:MANAGE', (req) => {
    const target = findConfig(idOf(req));
    const status = bodyOf(req).status;
    if (status !== 'ENABLED' && status !== 'DISABLED') {
      throw fail([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    }
    target.status = status;
    target.updatedAt = new Date().toISOString();
    return ok(configOut(target));
  }),

  'GET /api/admin/tasks/records': guard('TASK:VIEW', (req) => {
    const accountId = queryText(req.query.accountId);
    const status = oneOfOrEmpty(req.query.status, 'status', RECORD_STATUSES);
    const from = dayFilter(req, 'from');
    const to = dayFilter(req, 'to');
    const rows = activityState.taskRecords
      .filter((r) => accountId === '' || r.accountId === accountId)
      .filter((r) => status === '' || r.status === status)
      .filter((r) => from === '' || r.taskDate >= from)
      .filter((r) => to === '' || r.taskDate <= to)
      .sort(byNewest);
    const page = paginateQuery(rows, req);
    return ok({
      items: page.items.map((r) => ({
        ...r,
        taskName: activityState.taskConfigs.find((c) => c.id === r.taskId)?.taskName ?? null,
      })),
      total: page.total,
    });
  }),
};
