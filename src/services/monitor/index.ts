import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';

export { ALERT_TYPES, type AlertType, alertTypeKey, isKnownAlertType } from './alertTypes';

export type AlertStatus = 'OPEN' | 'RESOLVED';

/** A background alert (contract 17.4, `AdminAlert`). `type` can be a kind this page does not know. */
export type AdminAlert = {
  id: string;
  type: string;
  /** null when the alert is not about one account. */
  accountId: string | null;
  refType: string | null;
  refId: string | null;
  detail: string | null;
  status: AlertStatus | string;
  createdAt: string;
  resolvedAt: string | null;
};

export type AlertQuery = {
  status?: AlertStatus;
  type?: string;
  page: number;
  pageSize: number;
};

/** `GET /alerts` (`MONITOR:VIEW`). */
export const listAlerts = (query: AlertQuery): Promise<Page<AdminAlert>> =>
  apiRequest<Page<AdminAlert>>({ method: 'GET', url: '/alerts', params: { ...query } });

/**
 * `POST /alerts/{id}/resolve` (`MONITOR:MANAGE`, audited). For LOOK_PACKAGE_PREPARE_FAILED it also
 * resets the failure count of the driving package and queues the prepare job again (contract 3.9).
 */
export const resolveAlert = async (id: string): Promise<void> => {
  await apiRequest<unknown>({ method: 'POST', url: `/alerts/${encodeURIComponent(id)}/resolve` });
};

/** A sample of the pipeline; every figure can be missing (the sender reports what it can measure). */
export type PipelinePoint = {
  reportedAt: string;
  effectiveAt?: string;
  source: string;
  /** 0 to 1. */
  gpuUtilization: number | null;
  errorCount: number | null;
  /** 0 to 1. */
  errorRate: number | null;
};

export type PipelineQuery = {
  /** ISO-8601 instants; the backend uses the last 24 hours when they are left out. */
  from?: string;
  to?: string;
  source?: string;
};

/** `GET /monitor/pipeline` (`MONITOR:VIEW`): points by time, oldest first; `truncated` when there were more than the limit. */
export const getPipeline = (
  query: PipelineQuery,
): Promise<{ items: PipelinePoint[]; truncated: boolean }> =>
  apiRequest<{ items: PipelinePoint[]; truncated: boolean }>({
    method: 'GET',
    url: '/monitor/pipeline',
    params: { ...query },
  });
