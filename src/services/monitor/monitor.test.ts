import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { resetSessionState, setToken } from '../../request/session';
import {
  ALERT_TYPES,
  alertTypeKey,
  getPipeline,
  isKnownAlertType,
  listAlerts,
  resolveAlert,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

/** The fourteen types the contract lists in the background alert paragraph of 17.4. */
const contractAlertTypes = (): string[] => {
  const text = readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8');
  const start = text.indexOf('**后台告警（`AdminAlert`）**');
  const end = text.indexOf('**凡是能确定账号的告警', start);
  const paragraph = text.slice(start, end);
  const list = paragraph.slice(paragraph.indexOf('共十四种'));
  return [...list.matchAll(/(?:：|、)`([A-Z_]+)`（/g)].map((m) => m[1]);
};

describe('the alert type table', () => {
  it('is the fourteen types of the contract, not the thirteen of the spec', () => {
    const fromContract = contractAlertTypes();
    expect(fromContract).toHaveLength(14);
    expect([...ALERT_TYPES].sort()).toEqual([...fromContract].sort());
    expect(ALERT_TYPES).toContain('LOOK_PACKAGE_PREPARE_FAILED');
  });

  it('has a text in both languages for every type', () => {
    for (const type of ALERT_TYPES) {
      expect(zhCN[alertTypeKey(type)], type).toBeTruthy();
      expect(enUS[alertTypeKey(type)], type).toBeTruthy();
    }
  });

  it('knows its own types and nothing else', () => {
    expect(isKnownAlertType('DELETION_FAILED')).toBe(true);
    expect(isKnownAlertType('SOMETHING_NEW')).toBe(false);
    expect(isKnownAlertType('constructor')).toBe(false);
  });
});

describe('monitor services', () => {
  it('lists alerts with the status and type filters and the paging', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [], total: 0 })));
    await listAlerts({ status: 'OPEN', type: 'DELETION_FAILED', page: 2, pageSize: 50 });
    await listAlerts({ page: 1, pageSize: 20 });
    expect(calls[0].url).toBe(
      '/api/admin/alerts?status=OPEN&type=DELETION_FAILED&page=2&pageSize=50',
    );
    expect(calls[1].url).toBe('/api/admin/alerts?page=1&pageSize=20');
  });

  it('closes an alert with POST and no body', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await resolveAlert('77');
    expect(calls[0].url).toBe('/api/admin/alerts/77/resolve');
    expect(calls[0].init.method).toBe('POST');
  });

  it('reads the pipeline for a range and a source', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { items: [], truncated: false })),
    );
    await getPipeline({
      from: '2026-10-25T00:00:00.000Z',
      to: '2026-10-26T00:00:00.000Z',
      source: 'agent-server-1',
    });
    await getPipeline({});
    expect(calls[0].url).toBe(
      '/api/admin/monitor/pipeline?from=2026-10-25T00%3A00%3A00.000Z&to=2026-10-26T00%3A00%3A00.000Z&source=agent-server-1',
    );
    expect(calls[1].url).toBe('/api/admin/monitor/pipeline');
  });
});
