import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';

// 埋点管理 (contract 7 and 17.4). The page routes `/analytics/summary` and so on are not the
// interface paths; these are. Response field names are the backend's reply 13 for the summary, the
// names and the funnel; the field names of the event list and of the saved funnel are not written
// down anywhere yet (docs/contract-requests/2026-10-26-admin-frontend-analytics.md).

/** A range of UTC calendar days, `YYYY-MM-DD`, both ends included. */
export type DayRange = { from: string; to: string };

/** One row of `GET /analytics/events`. The IP is what the backend sent: masked, or whole with `ANALYTICS:IP_VIEW`. */
export type AnalyticsEvent = {
  id: string;
  eventName: string;
  /** Empty for an event of a device that is not signed in. */
  accountId: string | null;
  deviceId: string;
  /** When the server received the batch: the time the statistics use. */
  receivedAt: string;
  /** What the app wrote down itself. Not trustworthy; only for finding out what happened. */
  clientTime: string | null;
  country: string | null;
  ip: string | null;
  /** Free JSON of the event. */
  params: unknown;
  /** `platform`, `appVersion`, `osVersion`, `deviceModel`, `locale`, `network`, `channel`: what the app sent along. */
  context: unknown;
};

export type EventQuery = DayRange & {
  page: number;
  pageSize: number;
  accountId?: string;
  deviceId?: string;
  eventName?: string;
};

/** `GET /analytics/events` (`ANALYTICS:VIEW`): the detail of events, newest first. */
export const listEvents = (query: EventQuery): Promise<Page<AnalyticsEvent>> =>
  apiRequest<Page<AnalyticsEvent>>({ method: 'GET', url: '/analytics/events', params: query });

export type EventSummaryRow = { eventName: string; pv: number; uv: number };

/** `GET /analytics/event-summary` (`ANALYTICS:VIEW`): every event name of the range, not paged. */
export const getEventSummary = (range: DayRange): Promise<{ items: EventSummaryRow[] }> =>
  apiRequest<{ items: EventSummaryRow[] }>({
    method: 'GET',
    url: '/analytics/event-summary',
    params: range,
  });

/** `GET /analytics/event-names` (`ANALYTICS:VIEW`): the names that appear in the range, ascending. */
export const getEventNames = (range: DayRange): Promise<{ items: string[] }> =>
  apiRequest<{ items: string[] }>({ method: 'GET', url: '/analytics/event-names', params: range });

export type FunnelStepResult = {
  eventName: string;
  /** Distinct subjects that got this far. */
  count: number;
  /** 0 to 1; null for the first step and when the step before has nobody. */
  conversionFromPrevious: number | null;
};

export type FunnelQuery = DayRange & { steps: string[]; windowHours: number };

/** `GET /analytics/funnel` (`ANALYTICS:VIEW`): the steps in the order asked, with counts. */
export const getFunnel = ({
  steps,
  windowHours,
  from,
  to,
}: FunnelQuery): Promise<{ steps: FunnelStepResult[] }> =>
  apiRequest<{ steps: FunnelStepResult[] }>({
    method: 'GET',
    url: '/analytics/funnel',
    // the contract takes the steps as one comma-joined value
    params: { steps: steps.join(','), windowHours, from, to },
  });

export type SavedFunnel = {
  id: string;
  name: string;
  steps: string[];
  windowHours: number;
  /** Written by the system at start-up; read only. */
  isPreset: boolean;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedFunnelBody = { name: string; steps: string[]; windowHours: number };

/** `GET /analytics/funnels` (`ANALYTICS:VIEW`): the saved funnels. Reads `{items}` or a bare array. */
export const listSavedFunnels = async (): Promise<SavedFunnel[]> => {
  const answer = await apiRequest<SavedFunnel[] | { items: SavedFunnel[] }>({
    method: 'GET',
    url: '/analytics/funnels',
  });
  return Array.isArray(answer) ? answer : answer.items;
};

/** `POST /analytics/funnels` (`ANALYTICS:FUNNEL_MANAGE`). */
export const createSavedFunnel = (body: SavedFunnelBody): Promise<SavedFunnel> =>
  apiRequest<SavedFunnel>({ method: 'POST', url: '/analytics/funnels', body });

/** `PUT /analytics/funnels/{id}` (`ANALYTICS:FUNNEL_MANAGE`); a preset cannot be changed. */
export const updateSavedFunnel = (id: string, body: SavedFunnelBody): Promise<SavedFunnel> =>
  apiRequest<SavedFunnel>({
    method: 'PUT',
    url: `/analytics/funnels/${encodeURIComponent(id)}`,
    body,
  });

/** `DELETE /analytics/funnels/{id}` (`ANALYTICS:FUNNEL_MANAGE`); a preset cannot be deleted. */
export const deleteSavedFunnel = async (id: string): Promise<void> => {
  await apiRequest<unknown>({
    method: 'DELETE',
    url: `/analytics/funnels/${encodeURIComponent(id)}`,
  });
};
