import { ALERT_TYPES } from '../src/services/monitor/alertTypes';
import { guard } from './_core/auth';
import { invalidRequest, MockHttpError, ok } from './_core/http';
import {
  monitorStore,
  PIPELINE_MAX_POINTS,
  PIPELINE_MAX_RANGE_DAYS,
  PIPELINE_SOURCES,
  PIPELINE_STEP_MS,
} from './_core/monitorData';
import { paginate, pagingOf } from './_core/paginate';

const DAY_MS = 24 * 3600_000;

type Point = {
  reportedAt: string;
  effectiveAt: string;
  source: string;
  gpuUtilization: number | null;
  errorCount: number | null;
  errorRate: number | null;
};

const round = (v: number, digits: number) => Number(v.toFixed(digits));

// What each sender measures: server 1 everything (with a gap in the GPU figure now and then),
// server 2 no error rate, server 3 only the GPU. A figure that is not measured is null.
function pointOf(source: string, at: number): Point {
  const slot = Math.floor(at / PIPELINE_STEP_MS);
  const iso = new Date(slot * PIPELINE_STEP_MS).toISOString();
  const base = { reportedAt: iso, effectiveAt: iso, source };
  if (source === 'agent-server-1') {
    const errors = slot % 11 === 0 ? 4 : slot % 3;
    return {
      ...base,
      gpuUtilization: slot % 7 === 0 ? null : round(0.45 + 0.35 * Math.sin(slot / 20), 3),
      errorCount: errors,
      errorRate: round(errors * 0.007, 4),
    };
  }
  if (source === 'agent-server-2') {
    return {
      ...base,
      gpuUtilization: round(0.25 + 0.2 * Math.sin(slot / 35 + 1), 3),
      errorCount: slot % 5,
      errorRate: null,
    };
  }
  return {
    ...base,
    gpuUtilization: round(0.6 + 0.3 * Math.cos(slot / 15), 3),
    errorCount: null,
    errorRate: null,
  };
}

const instant = (ref: string, value: unknown): number | null => {
  if (value === undefined || value === '') return null;
  const text = String(value);
  const ms = /^\d{4}-\d{2}-\d{2}T/.test(text) ? Date.parse(text) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw invalidRequest(`${ref} is not an instant`, [{ ref, reason: 'INVALID_PATH' }]);
  }
  return ms;
};

export default {
  'GET /api/admin/monitor/pipeline': guard('MONITOR:VIEW', (req) => {
    const now = Date.now();
    const to = instant('to', req.query.to) ?? now;
    const from = instant('from', req.query.from) ?? to - DAY_MS;
    if (from > to || to - from > PIPELINE_MAX_RANGE_DAYS * DAY_MS) {
      throw invalidRequest('the range is longer than allowed', [
        { ref: 'from', reason: 'OUT_OF_RANGE' },
      ]);
    }
    const wanted =
      typeof req.query.source === 'string' && req.query.source !== '' ? req.query.source : null;
    const sources = PIPELINE_SOURCES.filter((s) => wanted === null || s === wanted);
    const points: Point[] = [];
    if (!monitorStore.pipelineEmpty) {
      const end = Math.min(to, now);
      for (
        let t = Math.ceil(from / PIPELINE_STEP_MS) * PIPELINE_STEP_MS;
        t <= end;
        t += PIPELINE_STEP_MS
      ) {
        for (const source of sources) points.push(pointOf(source, t));
      }
    }
    const truncated = points.length > PIPELINE_MAX_POINTS;
    return ok({ items: truncated ? points.slice(-PIPELINE_MAX_POINTS) : points, truncated });
  }),

  'GET /api/admin/alerts': guard('MONITOR:VIEW', (req) => {
    // Leave a parameter out for "all"; an empty one is a value, and so is anything but the exact
    // spelling of one of the two states or of the eighteen types (contract 17.4 and the answers of the
    // backend of 2026-10-31). The error of the paging comes before these.
    const { page, pageSize } = pagingOf(req);
    paginate([], page, pageSize);
    const status = req.query.status;
    if (status !== undefined && status !== 'OPEN' && status !== 'RESOLVED') {
      throw invalidRequest('status is not valid', [{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    }
    const type = req.query.type;
    if (type !== undefined && !(ALERT_TYPES as readonly unknown[]).includes(type)) {
      throw invalidRequest('type is not valid', [{ ref: 'type', reason: 'OUT_OF_RANGE' }]);
    }
    const rows = monitorStore.alerts
      .filter((a) => status === undefined || a.status === status)
      .filter((a) => type === undefined || a.type === type)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return ok(paginate(rows, page, pageSize));
  }),

  'POST /api/admin/alerts/:id/resolve': guard('MONITOR:MANAGE', (req) => {
    const alert = monitorStore.alerts.find((a) => a.id === req.params.id);
    if (!alert) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such alert');
    if (alert.status !== 'OPEN') {
      throw new MockHttpError(409, 'INVALID_STATE', 'The alert is not open', {
        status: alert.status,
      });
    }
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    // contract 3.9: closing it by hand clears the failure count and lets the next request queue the job again
    if (alert.type === 'LOOK_PACKAGE_PREPARE_FAILED')
      monitorStore.lookPackageResets.push(alert.refId);
    return ok(null);
  }),
};
