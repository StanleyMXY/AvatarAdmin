import { describe, expect, it } from 'vitest';
import type { ClientConfigItem } from '../../services/clientConfig';
import { sameVersion } from './version';

const item = (over: Partial<ClientConfigItem> = {}): ClientConfigItem => ({
  key: 'inviteShareTitle',
  type: 'STRING',
  localized: true,
  readOnly: false,
  configured: true,
  defaultValue: null,
  values: { '': 'Join me', th: 'มาใช้แอปด้วยกัน', ar: 'انضم إلي' },
  updatedBy: '1001',
  updatedByUsername: 'root',
  updatedAt: '2026-10-20T08:30:00.000Z',
  ...over,
});

describe('sameVersion: is the key as it was when the editor opened', () => {
  it('is the same when the time of the key is the same, whatever the order of the languages', () => {
    const opened = item();
    const current = item({ values: { ar: 'انضم إلي', th: 'มาใช้แอปด้วยกัน', '': 'Join me' } });
    expect(sameVersion(opened, current)).toBe(true);
  });

  it('is not the same when the time of the key moved, also when the values read the same', () => {
    expect(sameVersion(item(), item({ updatedAt: '2026-10-20T08:30:00.001Z' }))).toBe(false);
  });

  it('is not the same when someone reset the key (time to null) or configured it (null to a time)', () => {
    expect(sameVersion(item(), item({ updatedAt: null, configured: false, values: {} }))).toBe(
      false,
    );
    expect(sameVersion(item({ updatedAt: null, configured: false, values: {} }), item())).toBe(
      false,
    );
  });

  it('is the same for a key nobody configured, before and after', () => {
    const none = { updatedAt: null, configured: false, values: {} };
    expect(sameVersion(item(none), item(none))).toBe(true);
  });

  it('compares the values when the backend sends no time at all', () => {
    const without = (values: Record<string, string>) =>
      item({ updatedAt: undefined as unknown as null, values });
    expect(sameVersion(without({ '': 'a', th: 'ก' }), without({ th: 'ก', '': 'a' }))).toBe(true);
    expect(sameVersion(without({ '': 'a', th: 'ก' }), without({ '': 'a', th: 'ข' }))).toBe(false);
    expect(sameVersion(without({ '': 'a' }), without({ '': 'a', ar: 'ب' }))).toBe(false);
  });

  it('compares the values when only one of the two readings has a time', () => {
    const noTime = { updatedAt: null };
    expect(sameVersion(item(), item(noTime))).toBe(true);
    expect(sameVersion(item(), item({ ...noTime, values: { '': 'other' } }))).toBe(false);
  });

  it('compares the values when the time is an empty text', () => {
    const blank = (values: Record<string, string>) => item({ updatedAt: '', values });
    expect(sameVersion(blank({ '': 'a' }), blank({ '': 'b' }))).toBe(false);
    expect(sameVersion(blank({ '': 'a' }), blank({ '': 'a' }))).toBe(true);
  });

  it('is not the same when the key is not in the answer any more', () => {
    expect(sameVersion(item(), undefined)).toBe(false);
  });
});
