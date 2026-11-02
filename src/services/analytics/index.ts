import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';

// 埋点管理 (contract 7 and 17.4). The page routes `/analytics/summary` and so on are not the
// interface paths; these are. Response field names are the backend's answers 26 and 56 (docs/backend-inputs,
// 2026-11-02) for the event list and the live endpoints, and the backend's reply 13 for the summary,
// the names and the funnel.

/**
 * The range of the four live endpoints (`event-summary`, `event-names`, `funnel`, `events`): two
 * ISO-8601 instants ending in `Z`, `[from, to)`, both always sent (there is no default range). To
 * read whole UTC days, `to` is the start of the day after the last one (`utcDayRangeToInstants`).
 * A range longer than `analytics.live_max_range_days` days (a length of time, not a count of
 * calendar days) is refused with a 400 on `to`.
 */
export type InstantRange = { from: string; to: string };

/** One row of `GET /analytics/events`. The IP is what the backend sent: masked, or whole with `ANALYTICS:IP_VIEW`. */
export type AnalyticsEvent = {
  /** The id of the row in the event log (24 hexadecimal characters): stable, so it is the row key. */
  id: string;
  /** The name of the event. The summary and the funnel call it `eventName`; this list calls it `name`. */
  name: string;
  /** `SERVER` events are written by the backend itself and have no `context`, `clientTime`, `ip`, `country` or `deviceId`. */
  source: 'CLIENT' | 'SERVER';
  /** Empty for an event of a device that is not signed in. */
  accountId: string | null;
  deviceId: string | null;
  /** When the server received the batch: the time the statistics use. */
  receivedAt: string;
  /** The place of the event in its batch; of events with the same `receivedAt` the one with the larger `seq` is listed first. */
  seq: number;
  /** What the app wrote down itself. Not trustworthy; only for finding out what happened. */
  clientTime: string | null;
  country: string | null;
  ip: string | null;
  /** Free JSON of the event. */
  params: unknown;
  /** `platform`, `appVersion`, `osVersion`, `deviceModel`, `locale`, `network`, `channel`: what the app sent along; null for a `SERVER` event. */
  context: unknown;
};

export type EventQuery = InstantRange & {
  page: number;
  pageSize: number;
  accountId?: string;
  deviceId?: string;
  /** The event name, exact: `[a-z0-9_]{1,64}`. The parameter is `name`, not `eventName`. */
  name?: string;
};

/** `GET /analytics/events` (`ANALYTICS:VIEW`): the detail of events, newest first. */
export const listEvents = (query: EventQuery): Promise<Page<AnalyticsEvent>> =>
  apiRequest<Page<AnalyticsEvent>>({ method: 'GET', url: '/analytics/events', params: query });

export type EventSummaryRow = { eventName: string; pv: number; uv: number };

/** `GET /analytics/event-summary` (`ANALYTICS:VIEW`): every event name of the range, not paged. */
export const getEventSummary = (range: InstantRange): Promise<{ items: EventSummaryRow[] }> =>
  apiRequest<{ items: EventSummaryRow[] }>({
    method: 'GET',
    url: '/analytics/event-summary',
    params: range,
  });

/** `GET /analytics/event-names` (`ANALYTICS:VIEW`): the names that appear in the range, ascending. */
export const getEventNames = (range: InstantRange): Promise<{ items: string[] }> =>
  apiRequest<{ items: string[] }>({ method: 'GET', url: '/analytics/event-names', params: range });

export type FunnelStepResult = {
  eventName: string;
  /** Distinct subjects that got this far. */
  count: number;
  /** 0 to 1; null for the first step and when the step before has nobody. */
  conversionFromPrevious: number | null;
};

export type FunnelQuery = InstantRange & { steps: string[]; windowHours: number };

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
