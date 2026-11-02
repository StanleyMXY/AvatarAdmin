import { apiRequest } from '../../request/apiClient';
import type {
  MissingLocales,
  Page,
  PushRecord,
  PushRecordDetail,
  PushSchedule,
  PushTask,
  PushTemplate,
  RecordFilters,
  ScheduleFields,
  TaskCreate,
  TemplateCreate,
  TemplateOverview,
  TemplateUpdate,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

const list = <T>(url: string, params: Paging & RecordFilters): Promise<Page<T>> =>
  apiRequest<Page<T>>({ method: 'GET', url, params });

// ---- templates (PUSH:TEMPLATE) ----

/**
 * For each recall reason, the supported languages that have no enabled template (they fall back to
 * the default language). Reasons whose value is not a list of texts are left out; anything that is
 * not an object is no answer at all.
 */
export function readMissingLocales(value: unknown): MissingLocales | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const result: MissingLocales = {};
  for (const [reason, locales] of Object.entries(value)) {
    if (Array.isArray(locales)) {
      result[reason] = locales.filter((locale): locale is string => typeof locale === 'string');
    }
  }
  return result;
}

/**
 * Every template and `missingLocales`: one request. The backend does not page this list (it ignores
 * `page` and `pageSize`, has no `total` and answers the whole list every time), so nothing is
 * asked for a second page: a second request would bring the same rows again.
 */
export async function listTemplates(): Promise<TemplateOverview> {
  const data = await apiRequest<{ items?: unknown; missingLocales?: unknown } | null>({
    method: 'GET',
    url: '/push/templates',
  });
  const items = Array.isArray(data?.items) ? (data.items as PushTemplate[]) : [];
  return { items, missingLocales: readMissingLocales(data?.missingLocales) };
}

export const createTemplate = (body: TemplateCreate): Promise<PushTemplate> =>
  apiRequest({ method: 'POST', url: '/push/templates', body });

/** A `PUT` replaces the whole row: the reason and the language are in every one (the backend answers 400 without them), and so is `enabled`. */
export const updateTemplate = (id: string, body: TemplateUpdate): Promise<PushTemplate> =>
  apiRequest({ method: 'PUT', url: `/push/templates/${enc(id)}`, body });

export const deleteTemplate = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/push/templates/${enc(id)}` });

// ---- manual tasks (PUSH:SEND) ----

export const listTasks = (params: Paging): Promise<Page<PushTask>> => list('/push/tasks', params);

export const createTask = (body: TaskCreate): Promise<PushTask> =>
  apiRequest({ method: 'POST', url: '/push/tasks', body });

/** A task that is PENDING or RUNNING can be cancelled; 409 INVALID_STATE (`data.status` is the current state) once it is DONE or CANCELLED. */
export const cancelTask = (id: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/push/tasks/${enc(id)}/cancel` });

// ---- periodic pushes (PUSH:SEND) ----

export const listSchedules = (params: Paging): Promise<Page<PushSchedule>> =>
  list('/push/schedules', params);

export const createSchedule = (body: ScheduleFields): Promise<PushSchedule> =>
  apiRequest({ method: 'POST', url: '/push/schedules', body });

export const updateSchedule = (id: string, body: ScheduleFields): Promise<PushSchedule> =>
  apiRequest({ method: 'PUT', url: `/push/schedules/${enc(id)}`, body });

/** Deactivates the schedule; the tasks it has made are kept (contract 17.4). */
export const deleteSchedule = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/push/schedules/${enc(id)}` });

// ---- records (PUSH:VIEW) ----

export const listRecords = (params: Paging & RecordFilters): Promise<Page<PushRecord>> =>
  list('/push/records', params);

/**
 * A record with the result for each token. The contract says the detail "returns the PushDelivery
 * of each token" without naming the list, so `deliveries` is read, and `items` if that is what
 * the answer has; none gives an empty list.
 */
export async function getRecord(id: string): Promise<PushRecordDetail> {
  const data = await apiRequest<
    Omit<PushRecordDetail, 'deliveries'> & { deliveries?: unknown; items?: unknown }
  >({ method: 'GET', url: `/push/records/${enc(id)}` });
  const raw = Array.isArray(data.deliveries)
    ? data.deliveries
    : Array.isArray(data.items)
      ? data.items
      : [];
  const { items: _items, ...record } = data;
  return { ...record, deliveries: raw as PushRecordDetail['deliveries'] };
}
