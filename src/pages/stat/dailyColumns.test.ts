import { describe, expect, it } from 'vitest';
import type { StatDailyRow } from '../../services/stats/types';
import {
  buildDailyColumns,
  type ColumnDef,
  chartRow,
  formatDailyCell,
  isBackfilledCell,
  toViewRow,
} from './dailyColumns';

const row = (over: Partial<StatDailyRow> = {}): StatDailyRow => ({
  statDate: '2026-10-20',
  dau: 1200,
  dauDevices: 1500,
  wau: 4000,
  mau: 12000,
  avatarCreatedAccounts: 30,
  voiceClonedAccounts: 10,
  sessionStartedAccounts: 500,
  newAccountsRegistered: 80,
  guestDevicesNew: 200,
  guestDevicesConverted: 25,
  guestSessionsConnected: 90,
  guestCallSecondsTotal: 7200,
  sessionsConnected: 900,
  accountsWithCall: 400,
  callSecondsTotal: 96000,
  messagesUser: 9000,
  messagesAssistant: 9500,
  newSubscriptions: 12,
  creditPurchases: 20,
  creditsSpent: 15000,
  activeSubscriptions: 1100,
  activeSubscriptionsBackfilled: false,
  ...over,
});

const byKey = (columns: ColumnDef[], key: string): ColumnDef => {
  const found = columns.find((c) => c.key === key);
  if (!found) throw new Error(`no column ${key}`);
  return found;
};
const cell = (key: string, over: Partial<StatDailyRow> = {}, platform = 'ALL', locale = 'en-US') =>
  formatDailyCell(byKey(buildDailyColumns(platform), key), toViewRow(row(over)), locale);

describe('buildDailyColumns', () => {
  it('lists the columns of the spec in order, the date first and fixed on the left', () => {
    const columns = buildDailyColumns('ALL');
    expect(columns.map((c) => c.key)).toEqual([
      'statDate',
      'dau',
      'wau',
      'mau',
      'dauDevices',
      'newAccountsRegistered',
      'guestDevicesNew',
      'guestDevicesConverted',
      'avatarCreatedAccounts',
      'voiceClonedAccounts',
      'sessionStartedAccounts',
      'sessionsConnected',
      'accountsWithCall',
      'callMinutesTotal',
      'callMinutesPerAccount',
      'messagesUser',
      'messagesAssistant',
      'newSubscriptions',
      'activeSubscriptions',
      'creditPurchases',
      'creditsSpent',
      'guestSessionsConnected',
      'guestCallMinutesTotal',
    ]);
    expect(columns[0].fixed).toBe('left');
    expect(columns.slice(1).every((c) => c.fixed === undefined)).toBe(true);
  });

  it('gives exactly the seven metrics of the spec a hint', () => {
    expect(
      buildDailyColumns('ALL')
        .filter((c) => c.tip)
        .map((c) => c.key),
    ).toEqual([
      'dau',
      'wau',
      'mau',
      'dauDevices',
      'guestDevicesNew',
      'sessionsConnected',
      'activeSubscriptions',
    ]);
  });

  it('marks no column as lacking the platform dimension for ALL', () => {
    expect(buildDailyColumns('ALL').some((c) => c.noPlatformDimension)).toBe(false);
  });

  it('marks the business columns, and only those, for ANDROID and IOS', () => {
    for (const platform of ['ANDROID', 'IOS']) {
      const marked = buildDailyColumns(platform)
        .filter((c) => c.noPlatformDimension)
        .map((c) => c.key);
      expect(marked).toEqual([
        'newAccountsRegistered',
        'guestDevicesNew',
        'guestDevicesConverted',
        'sessionsConnected',
        'accountsWithCall',
        'callMinutesTotal',
        'callMinutesPerAccount',
        'messagesUser',
        'messagesAssistant',
        'newSubscriptions',
        'activeSubscriptions',
        'creditPurchases',
        'creditsSpent',
        'guestSessionsConnected',
        'guestCallMinutesTotal',
      ]);
    }
  });

  it('keeps the event columns (the counts that have a platform) unmarked', () => {
    const columns = buildDailyColumns('ANDROID');
    for (const key of [
      'dau',
      'wau',
      'mau',
      'dauDevices',
      'avatarCreatedAccounts',
      'voiceClonedAccounts',
      'sessionStartedAccounts',
    ]) {
      expect(byKey(columns, key).noPlatformDimension, key).toBe(false);
    }
  });
});

describe('formatDailyCell', () => {
  it('writes counts with the separators of the language', () => {
    expect(cell('dau', { dau: 1234567 })).toBe('1,234,567');
    expect(cell('dau', { dau: 1234567 }, 'ALL', 'de-DE')).toBe('1.234.567');
  });

  it('shows a dash, not 0, for a column the backend sent as null', () => {
    expect(cell('dau', { dau: null })).toBe('—');
    expect(cell('creditsSpent', { creditsSpent: null })).toBe('—');
  });

  it('shows a real 0 as 0', () => {
    expect(cell('dau', { dau: 0 })).toBe('0');
  });

  it('shows a dash in every business cell when the platform is not ALL, even if a number came', () => {
    for (const platform of ['ANDROID', 'IOS']) {
      for (const c of buildDailyColumns(platform).filter((d) => d.noPlatformDimension)) {
        expect(formatDailyCell(c, toViewRow(row()), 'en-US'), `${platform} ${c.key}`).toBe('—');
      }
    }
    expect(cell('dau', {}, 'ANDROID')).toBe('1,200');
  });

  it('shows the business numbers for ALL', () => {
    expect(cell('newAccountsRegistered')).toBe('80');
    expect(cell('messagesUser')).toBe('9,000');
  });

  it('writes the call total in minutes: seconds divided by 60, one decimal', () => {
    expect(cell('callMinutesTotal', { callSecondsTotal: 96000 })).toBe('1,600');
    expect(cell('callMinutesTotal', { callSecondsTotal: 100 })).toBe('1.7');
    expect(cell('guestCallMinutesTotal', { guestCallSecondsTotal: 7200 })).toBe('120');
  });

  it('computes the minutes per person as callSecondsTotal / 60 / accountsWithCall', () => {
    expect(cell('callMinutesPerAccount', { callSecondsTotal: 96000, accountsWithCall: 400 })).toBe(
      '4',
    );
    expect(cell('callMinutesPerAccount', { callSecondsTotal: 1000, accountsWithCall: 3 })).toBe(
      '5.6',
    );
  });

  it('shows a dash for the minutes per person when nobody called, or a part is missing', () => {
    expect(cell('callMinutesPerAccount', { callSecondsTotal: 0, accountsWithCall: 0 })).toBe('—');
    expect(cell('callMinutesPerAccount', { callSecondsTotal: 500, accountsWithCall: 0 })).toBe('—');
    expect(cell('callMinutesPerAccount', { callSecondsTotal: null })).toBe('—');
    expect(cell('callMinutesPerAccount', { accountsWithCall: null })).toBe('—');
    expect(cell('callMinutesTotal', { callSecondsTotal: null })).toBe('—');
    expect(cell('guestCallMinutesTotal', { guestCallSecondsTotal: null })).toBe('—');
  });

  it('shows 0 minutes per person when people called for no time (a real zero)', () => {
    expect(cell('callMinutesPerAccount', { callSecondsTotal: 0, accountsWithCall: 5 })).toBe('0');
  });

  it('shows a dash for the active subscriptions of today or a day without a snapshot (null)', () => {
    expect(cell('activeSubscriptions', { activeSubscriptions: null })).toBe('—');
    expect(cell('activeSubscriptions', { activeSubscriptions: 1100 })).toBe('1,100');
  });

  it('shows a dash for the active subscriptions when a channel took the snapshot away, whatever the flag', () => {
    expect(
      cell('activeSubscriptions', {
        activeSubscriptions: null,
        activeSubscriptionsBackfilled: null,
      }),
    ).toBe('—');
  });

  it('shows a value and a dash without ever turning a dash into a division result', () => {
    const view = toViewRow(row({ callSecondsTotal: null, accountsWithCall: 10 }));
    expect(Number.isNaN(view.callMinutesPerAccount)).toBe(false);
    expect(view.callMinutesPerAccount).toBeNull();
  });
});

describe('isBackfilledCell', () => {
  const columns = buildDailyColumns('ALL');
  const active = byKey(columns, 'activeSubscriptions');

  it('is true for a back-filled active-subscription value', () => {
    expect(isBackfilledCell(active, toViewRow(row({ activeSubscriptionsBackfilled: true })))).toBe(
      true,
    );
  });

  it('is false when the flag is false or null', () => {
    expect(isBackfilledCell(active, toViewRow(row({ activeSubscriptionsBackfilled: false })))).toBe(
      false,
    );
    expect(isBackfilledCell(active, toViewRow(row({ activeSubscriptionsBackfilled: null })))).toBe(
      false,
    );
  });

  it('is false when there is no value to mark, even if the flag is set', () => {
    expect(
      isBackfilledCell(
        active,
        toViewRow(row({ activeSubscriptions: null, activeSubscriptionsBackfilled: true })),
      ),
    ).toBe(false);
  });

  it('is false for every other column and for a platform without the dimension', () => {
    expect(
      isBackfilledCell(
        byKey(columns, 'dau'),
        toViewRow(row({ activeSubscriptionsBackfilled: true })),
      ),
    ).toBe(false);
    expect(
      isBackfilledCell(
        byKey(buildDailyColumns('IOS'), 'activeSubscriptions'),
        toViewRow(row({ activeSubscriptionsBackfilled: true })),
      ),
    ).toBe(false);
  });
});

describe('chartRow', () => {
  it('rounds the minute figures to one decimal, as the table shows them, and leaves counts and missing values alone', () => {
    const view = toViewRow(row({ callSecondsTotal: 12300, accountsWithCall: 3, dau: 1234 }));
    expect(view.callMinutesPerAccount).toBeCloseTo(68.3333333, 5);
    const chart = chartRow(view);
    expect(chart.callMinutesPerAccount).toBe(68.3);
    expect(chart.callMinutesTotal).toBe(205);
    expect(chart.dau).toBe(1234);
    const empty = chartRow(toViewRow(row({ callSecondsTotal: 0, accountsWithCall: 0 })));
    expect(empty.callMinutesPerAccount).toBeNull();
    expect(empty.callMinutesTotal).toBe(0);
  });
});
