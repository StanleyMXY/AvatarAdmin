import type { PermissionCode } from '../src/access/permissionCodes';
import { authenticate, hasPermission } from './_core/auth';
import { fail, MockHttpError, toUmiFile } from './_core/http';
import { between } from './_core/statData';
import { daysIn, rangeOf } from './_core/statRange';
import { store } from './_core/store';
import { buildXlsx, XLSX_CONTENT_TYPE } from './_core/xlsx';

// Contract 17.6: the export names and the permission of the page each one belongs to (besides STATS:EXPORT).
const VIEW_CODE: Record<string, PermissionCode> = {
  daily: 'STATS:VIEW',
  retention: 'STATS:VIEW',
  reactivation: 'STATS:VIEW',
  guest: 'STATS:VIEW',
  'guest-retention': 'STATS:VIEW',
  'session-quality': 'STATS:VIEW',
  push: 'STATS:VIEW',
  'usage-cost': 'COST:VIEW',
  'invite-records': 'INVITE:VIEW',
  'invite-stats': 'INVITE:VIEW',
  'share-funnel': 'INVITE:VIEW',
  'share-channel': 'INVITE:VIEW',
  'attribution-performance': 'ATTRIBUTION:VIEW',
  'ads-report': 'ADS:REPORT',
  'checkin-daily-users': 'STATS:VIEW',
  'checkin-streaks': 'STATS:VIEW',
  'task-summary': 'STATS:VIEW',
};

const PER_HOUR = 10;

export default {
  // A sample workbook (a day column and a number), not the real report: the mock has no tables to export.
  'GET /api/admin/stats/export/:name': toUmiFile((req) => {
    const admin = authenticate(req);
    const name = req.params.name ?? '';
    const view = VIEW_CODE[name];
    if (!view) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such export');
    if (!hasPermission(admin, ['STATS:EXPORT']) || !hasPermission(admin, [view])) {
      throw new MockHttpError(
        403,
        'ADMIN_FORBIDDEN',
        'The administrator lacks the permission for this export',
      );
    }
    const { from, to } = rangeOf(req);
    const now = Date.now();
    const recent = (store.exportUses.get(admin.id) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= PER_HOUR) {
      store.exportUses.set(admin.id, recent);
      return fail(429, 'RATE_LIMITED', 'Too many exports this hour');
    }
    store.exportUses.set(admin.id, [...recent, now]);
    const rows: (string | number)[][] = [
      ['statDate', 'value'],
      ...daysIn(from, to).map((day) => [day, between(1, 1000, 'export', name, day)]),
    ];
    return {
      file: {
        contentType: XLSX_CONTENT_TYPE,
        filename: `${name}-${from}-${to}.xlsx`,
        body: buildXlsx(rows),
      },
    };
  }),
};
