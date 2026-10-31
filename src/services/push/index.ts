import { apiRequest } from '../../request/apiClient';
import type {
  MissingLocales,
  Page,
  PushRecord,
  PushRecordDetail,
  PushSchedule,
  PushTask,
  PushTemplate,
  ScheduleFields,
  TaskCreate,
  TemplateCreate,
  TemplateFields,
  TemplateOverview,
  TemplatePage,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

const list = <T>(url: string, params: Paging): Promise<Page<T>> =>
  apiRequest<Page<T>>({ method: 'GET', url, params });

// ---- templates (PUSH:TEMPLATE) ----

/** `GET /push/templates`: the page, and `missingLocales` (the same for every page and filter). */
export const listTemplates = (params: Paging): Promise<TemplatePage> =>
  list('/push/templates', params);

const ALL_PAGE_SIZE = 200;

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
 * Every template, for the matrix, and `missingLocales` of the answer. It reads page after page.
 * With a numeric `total` it stops when it has that many rows. Without one (the answer of the
 * backend has none: contract a14) it stops at a page shorter than the page size, and at a page
 * that brings no row it has not seen yet, so a backend that does not page cannot make it loop. A
 * page with no rows always stops it. Each row is kept once.
 */
export async function listAllTemplates(): Promise<TemplateOverview> {
  const items: PushTemplate[] = [];
  const seen = new Set<string>();
  let missingLocales: MissingLocales | null = null;
  for (let page = 1; ; page += 1) {
    const answer = await listTemplates({ page, pageSize: ALL_PAGE_SIZE });
    if (page === 1) missingLocales = readMissingLocales(answer.missingLocales);
    const fresh = answer.items.filter((row) => !seen.has(String(row.id)));
    for (const row of fresh) seen.add(String(row.id));
    items.push(...fresh);
    if (answer.items.length === 0) return { items, missingLocales };
    if (typeof answer.total === 'number') {
      if (items.length >= answer.total) return { items, missingLocales };
    } else if (answer.items.length < ALL_PAGE_SIZE || fresh.length === 0) {
      return { items, missingLocales };
    }
  }
}

export const createTemplate = (body: TemplateCreate): Promise<PushTemplate> =>
  apiRequest({ method: 'POST', url: '/push/templates', body });

/** The reason and the language are the key of a template, so they are not part of the body. */
export const updateTemplate = (id: string, body: TemplateFields): Promise<PushTemplate> =>
  apiRequest({ method: 'PUT', url: `/push/templates/${enc(id)}`, body });

export const deleteTemplate = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/push/templates/${enc(id)}` });

// ---- manual tasks (PUSH:SEND) ----

export const listTasks = (params: Paging): Promise<Page<PushTask>> => list('/push/tasks', params);

export const createTask = (body: TaskCreate): Promise<PushTask> =>
  apiRequest({ method: 'POST', url: '/push/tasks', body });

/** 409 INVALID_STATE (`data.status` is the current state) once the task has started. */
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

export const listRecords = (params: Paging): Promise<Page<PushRecord>> =>
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
