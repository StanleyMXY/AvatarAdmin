import { apiRequest } from '../../request/apiClient';
import type {
  ActivityBody,
  ActivityStatus,
  CheckinActivity,
  CheckinActivityDetail,
  CheckinRecord,
  DisabledActivity,
  LifecycleStatus,
  Page,
  RecordStatus,
  TaskBody,
  TaskConfig,
  TaskRecord,
  TaskStatus,
  TaskType,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

// ---- sign-in activities (CHECKIN:VIEW to read, CHECKIN:MANAGE to write) ----

export const listCheckinActivities = (
  params: Paging & { name?: string; lifecycleStatus?: LifecycleStatus },
): Promise<Page<CheckinActivity>> =>
  apiRequest({ method: 'GET', url: '/checkin/activities', params });

/** One activity with its steps (`rewards`, by `dayNum`). */
export const getCheckinActivity = (id: string): Promise<CheckinActivityDetail> =>
  apiRequest({ method: 'GET', url: `/checkin/activities/${enc(id)}` });

export const createCheckinActivity = (body: ActivityBody): Promise<CheckinActivity> =>
  apiRequest({ method: 'POST', url: '/checkin/activities', body });

/**
 * Saves the activity as it is. The date range of an activity that is `ACTIVE` goes through
 * `probeActivityOverlap` first: a change that overlaps another live activity is not done without `confirm=true`.
 */
export const updateCheckinActivity = (id: string, body: ActivityBody): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/checkin/activities/${enc(id)}`, body });

/** 409 INVALID_STATE unless the activity is a draft without sign-in records. */
export const deleteCheckinActivity = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/checkin/activities/${enc(id)}` });

/** Stops a live activity. Going live is `probeActivityOverlap`, never this. */
export const setCheckinActivityStatus = (id: string, status: 'DISABLED'): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/checkin/activities/${enc(id)}/status`, body: { status } });

/** What puts an activity on the air or changes the range of one that is: `publish` (draft), `enable` (stopped), `update` (edit the range of a live one). */
export type ProbeAction = 'publish' | 'enable' | 'update';

const sendWithConfirm = (
  action: ProbeAction,
  id: string,
  body: ActivityBody | undefined,
  confirm: boolean,
) =>
  action === 'update'
    ? apiRequest<unknown>({
        method: 'PUT',
        url: `/checkin/activities/${enc(id)}`,
        body: { ...body, confirm },
      })
    : apiRequest<unknown>({
        method: 'PUT',
        url: `/checkin/activities/${enc(id)}/status`,
        body: { status: 'ACTIVE' satisfies ActivityStatus, confirm },
      });

const isDisabledActivity = (value: unknown): value is DisabledActivity =>
  typeof value === 'object' && value !== null && 'id' in value;

/**
 * The first step of publishing, enabling or editing the range of a live activity: the request goes
 * with `confirm=false`. When the backend did it (no overlap) the answer is `null`. When another
 * activity overlaps, nothing was done and the answer is the list of the activities that would be
 * stopped (`disabledActivities`; an empty list when the backend said `applied: false` without names).
 * The second step, after the person agreed, is `confirmActivityOverlap`.
 */
export async function probeActivityOverlap(
  action: ProbeAction,
  id: string,
  body?: ActivityBody,
): Promise<DisabledActivity[] | null> {
  const answer = await sendWithConfirm(action, id, body, false);
  const reply = (typeof answer === 'object' && answer !== null ? answer : {}) as {
    applied?: unknown;
    disabledActivities?: unknown;
  };
  const names = Array.isArray(reply.disabledActivities)
    ? reply.disabledActivities.filter(isDisabledActivity)
    : [];
  if (names.length > 0) return names;
  return reply.applied === false ? [] : null;
}

/** The second step: the same request with `confirm=true`; the backend stops what overlaps at that moment. */
export async function confirmActivityOverlap(
  action: ProbeAction,
  id: string,
  body?: ActivityBody,
): Promise<void> {
  await sendWithConfirm(action, id, body, true);
}

export const listCheckinRecords = (
  params: Paging & { accountId?: string; activityId?: string; from?: string; to?: string },
): Promise<Page<CheckinRecord>> => apiRequest({ method: 'GET', url: '/checkin/records', params });

// ---- daily tasks (TASK:VIEW to read, TASK:MANAGE to write) ----

export const listTaskConfigs = (
  params: Paging & { taskName?: string; taskType?: TaskType; status?: TaskStatus },
): Promise<Page<TaskConfig>> => apiRequest({ method: 'GET', url: '/tasks/configs', params });

export const createTaskConfig = (body: TaskBody): Promise<TaskConfig> =>
  apiRequest({ method: 'POST', url: '/tasks/configs', body });

/** 409 TASK_HAS_RECORDS when a configuration that has records gets another `taskType` or `targetValue`. */
export const updateTaskConfig = (id: string, body: TaskBody): Promise<TaskConfig> =>
  apiRequest({ method: 'PUT', url: `/tasks/configs/${enc(id)}`, body });

/** 409 TASK_HAS_RECORDS when records exist: only stopping is left then. */
export const deleteTaskConfig = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/tasks/configs/${enc(id)}` });

export const setTaskConfigStatus = (id: string, status: TaskStatus): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/tasks/configs/${enc(id)}/status`, body: { status } });

export const listTaskRecords = (
  params: Paging & { accountId?: string; status?: RecordStatus; from?: string; to?: string },
): Promise<Page<TaskRecord>> => apiRequest({ method: 'GET', url: '/tasks/records', params });
