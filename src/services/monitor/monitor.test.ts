import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { resetSessionState, setToken } from '../../request/session';
import {
  ALERT_TYPES,
  alertDetailKey,
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
  it('is the fourteen types of the contract plus the four the backend added, not the thirteen of the spec', () => {
    const fromContract = contractAlertTypes();
    expect(fromContract).toHaveLength(14);
    expect(ALERT_TYPES).toHaveLength(18);
    expect(new Set(ALERT_TYPES).size).toBe(18);
    for (const type of fromContract) expect(ALERT_TYPES, type).toContain(type);
    expect(ALERT_TYPES).toContain('LOOK_PACKAGE_PREPARE_FAILED');
    const added = ALERT_TYPES.filter((type) => !fromContract.includes(type)).sort();
    expect(added).toEqual([
      'POSTBACK_CREDENTIAL_FAILED',
      'STAT_RELAND_FAILED',
      'SUBSCRIPTION_EVENT_FAILED',
      'SUPPORT_FORWARD_FAILED',
    ]);
  });

  it('has a text in both languages for every type', () => {
    for (const type of ALERT_TYPES) {
      expect(zhCN[alertTypeKey(type)], type).toBeTruthy();
      expect(enUS[alertTypeKey(type)], type).toBeTruthy();
    }
  });

  it('knows its own types and nothing else', () => {
    expect(isKnownAlertType('DELETION_FAILED')).toBe(true);
    expect(isKnownAlertType('STAT_RELAND_FAILED')).toBe(true);
    expect(isKnownAlertType('SOMETHING_NEW')).toBe(false);
    expect(isKnownAlertType('constructor')).toBe(false);
  });
});

describe('the fixed details of an alert', () => {
  it('knows the three the backend writes, each only for its own type', () => {
    expect(alertDetailKey('SUPPORT_FORWARD_FAILED', 'attempts_exhausted')).toBe(
      'monitor.alert.detail.attempts_exhausted',
    );
    expect(alertDetailKey('POSTBACK_CREDENTIAL_FAILED', 'token_unreadable')).toBe(
      'monitor.alert.detail.token_unreadable',
    );
    expect(alertDetailKey('POSTBACK_CREDENTIAL_FAILED', 'pixel_id_malformed')).toBe(
      'monitor.alert.detail.pixel_id_malformed',
    );
    expect(alertDetailKey('POSTBACK_CREDENTIAL_FAILED', 'attempts_exhausted')).toBeNull();
    expect(alertDetailKey('SUPPORT_FORWARD_FAILED', 'token_unreadable')).toBeNull();
    expect(alertDetailKey('DELETION_FAILED', 'attempts_exhausted')).toBeNull();
  });

  it('knows nothing for an error code of the ad platform, an empty detail or a name of the prototype', () => {
    for (const detail of ['190', '', 'constructor', '__proto__'])
      expect(alertDetailKey('POSTBACK_CREDENTIAL_FAILED', detail), detail).toBeNull();
    expect(alertDetailKey('constructor', 'x')).toBeNull();
  });

  it("has a text in both languages for each, and the code beside it is the page's own format", () => {
    for (const code of ['attempts_exhausted', 'token_unreadable', 'pixel_id_malformed']) {
      expect(zhCN[`monitor.alert.detail.${code}`], code).toBeTruthy();
      expect(enUS[`monitor.alert.detail.${code}`], code).toBeTruthy();
    }
    expect(zhCN['monitor.alert.detailWithCode']).toContain('{code}');
    expect(enUS['monitor.alert.detailWithCode']).toContain('{code}');
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
