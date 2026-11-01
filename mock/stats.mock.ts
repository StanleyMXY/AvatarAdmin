import { guard } from './_core/auth';
import { sampleText } from './_core/fixtures';
import { invalidRequest, MockHttpError, ok } from './_core/http';
import {
  addDays,
  between,
  dailyRow,
  guestCohortRow,
  guestRetentionRow,
  retentionRow,
  todayOf,
  unit,
} from './_core/statData';
import {
  channelOf,
  daysIn,
  LAND_NAMES,
  oneOf,
  PLATFORMS,
  rangeOf,
  TRIGGERS,
  text,
  validDay,
} from './_core/statRange';

export default {
  'GET /api/admin/stats/daily': guard('STATS:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const platform = oneOf(req, 'platform', PLATFORMS, 'ALL');
    const channel = channelOf(req);
    return ok({ items: daysIn(from, to).map((day) => dailyRow(day, platform, channel, today)) });
  }),

  'GET /api/admin/stats/retention': guard('STATS:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const type = oneOf(req, 'type', ['ACTIVE', 'CALL'], 'ACTIVE');
    const platform = oneOf(req, 'platform', PLATFORMS, 'ALL');
    const channel = channelOf(req);
    return ok({
      items: daysIn(from, to).map((day) => retentionRow(day, type, platform, channel, today)),
    });
  }),

  'GET /api/admin/stats/reactivation': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const silenceDays = Number(oneOf(req, 'silenceDays', ['7', '14', '30'], '7'));
    return ok({
      items: daysIn(from, to).map((day) => {
        const silentUsers = between(200, 900, 'silent', day, silenceDays);
        return {
          statDate: day,
          silenceDays,
          silentUsers,
          reactivated: Math.round(silentUsers * (0.02 + unit('re', day) * 0.08)),
        };
      }),
    });
  }),

  'GET /api/admin/stats/guest/daily': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    return ok({
      items: daysIn(from, to).map((day) => ({
        statDate: day,
        guestDevicesNew: between(100, 300, 'gdn', day),
        guestDevicesConverted: between(10, 60, 'gdc', day),
      })),
    });
  }),

  'GET /api/admin/stats/guest/cohort': guard('STATS:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    return ok({ items: daysIn(from, to).map((day) => guestCohortRow(day, today)) });
  }),

  'GET /api/admin/stats/guest/retention': guard('STATS:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const platform = oneOf(req, 'platform', PLATFORMS, 'ALL');
    const channel = channelOf(req);
    return ok({
      items: daysIn(from, to).map((day) => guestRetentionRow(day, platform, channel, today)),
    });
  }),

  'GET /api/admin/stats/guest/quota': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const days = daysIn(from, to).length;
    const devices = 400 * days;
    const split = [0.2, 0.15, 0.15, 0.15, 0.15, 0.2];
    const keys = ['ZERO', 'LE_25', 'LE_50', 'LE_75', 'LT_100', 'GE_100'] as const;
    const buckets = Object.fromEntries(
      keys.map((key, i) => {
        const count = Math.round(devices * 0.9 * split[i]);
        return [key, { devices: count, converted: Math.round(count * (0.05 + i * 0.03)) }];
      }),
    );
    return ok({
      configuredTotalSeconds: 600,
      devices,
      noGrant: Math.round(devices * 0.1),
      neverCalled: Math.round(devices * 0.9 * 0.2),
      avgUsedSeconds: 240.5,
      exhausted: Math.round(devices * 0.9 * 0.2),
      buckets,
    });
  }),

  'GET /api/admin/stats/session-quality': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    return ok({
      items: daysIn(from, to).map((day) => {
        const connected = between(500, 1500, 'conn', day);
        // Every fourth day (by the calendar, so any seven days have one) is a bad one: a third of
        // the attempts fail and a fifth of the connects are slow. The total of a week then passes
        // both limits of the build, and the red frames of the page can be looked at.
        const bad = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) % 4 === 0;
        const le2 = Math.round(connected * (bad ? 0.4 : 0.5));
        const le5 = Math.round(connected * (bad ? 0.25 : 0.3));
        const le10 = Math.round(connected * 0.15);
        return {
          statDate: day,
          connected,
          agentUnavailable: bad ? Math.round(connected * 0.5) : between(0, 60, 'au', day),
          limitReached: between(0, 40, 'lr', day),
          discardedUserNotJoined: between(0, 30, 'du', day),
          joinLe2s: le2,
          joinLe5s: le5,
          joinLe10s: le10,
          joinGt10s: connected - le2 - le5 - le10,
          joinMsSum: connected * between(1800, 3200, 'ms', day),
        };
      }),
    });
  }),

  'GET /api/admin/stats/push': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const only = text(req.query.triggerReason);
    if (only && !TRIGGERS.includes(only)) {
      throw invalidRequest('triggerReason is not known', [
        { ref: 'triggerReason', reason: 'OUT_OF_RANGE' },
      ]);
    }
    return ok({
      items: daysIn(from, to).flatMap((day) =>
        TRIGGERS.filter((reason) => !only || reason === only).map((reason) => {
          const pushesSent = between(50, 600, 'ps', day, reason);
          const deliveriesOk = Math.round(pushesSent * 0.93);
          return {
            statDate: day,
            triggerReason: reason,
            pushesSent,
            deliveriesOk,
            deliveriesFailed: pushesSent - deliveriesOk,
            pushesOpened: Math.round(deliveriesOk * (0.05 + unit('po', day, reason) * 0.1)),
          };
        }),
      ),
    });
  }),

  'GET /api/admin/stats/usage-cost': guard('COST:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    // Resource types, sources and tiers are those of contract 14.2 and 17.6. Two currencies stay
    // apart, and the requests that had no price are the group under `NONE`.
    const lines = [
      {
        resourceType: 'LLM',
        provider: 'provider-a',
        model: 'model-x',
        unit: 'TOKENS_1M',
        source: 'CALL',
        tier: 'FREE',
        currency: 'USD',
      },
      {
        resourceType: 'LLM',
        provider: 'provider-a',
        model: 'model-x',
        unit: 'TOKENS_1M',
        source: 'TEXT',
        tier: 'PAID',
        currency: 'USD',
      },
      {
        resourceType: 'IMAGE_EDIT',
        provider: 'provider-b',
        model: 'edit-1',
        unit: 'CALL',
        source: 'GENERATION',
        tier: 'SYSTEM',
        currency: 'USD',
      },
      {
        resourceType: 'CLOUD_RENDER',
        provider: 'provider-c',
        model: 'render-1',
        unit: 'MINUTE',
        source: 'CALL',
        tier: 'PAID',
        currency: 'EUR',
      },
      {
        resourceType: 'MATTING',
        provider: 'provider-d',
        model: 'matte-1',
        unit: 'CALL',
        source: 'GENERATION',
        tier: 'UNKNOWN',
        currency: 'NONE',
      },
    ];
    const asked = (name: string) => text(req.query[name]);
    const wanted = lines.filter((line) =>
      (['resourceType', 'provider', 'model', 'source', 'tier', 'currency'] as const).every(
        (name) => asked(name) === '' || line[name] === asked(name),
      ),
    );
    // Whole micro-units, so that an amount is exact: 6 decimals, written as text.
    const amount = (micros: number) =>
      `${Math.floor(micros / 1_000_000)}.${String(micros % 1_000_000).padStart(6, '0')}`;
    return ok({
      items: daysIn(from, to).flatMap((day) =>
        wanted.map((line) => {
          const requests = between(200, 2000, 'rq', day, line.resourceType, line.source);
          const unpriced = line.currency === 'NONE';
          const llm = line.resourceType === 'LLM';
          return {
            statDate: day,
            ...line,
            requests,
            inputTokens: llm ? requests * 900 : null,
            cachedInputTokens: llm ? requests * 300 : null,
            outputTokens: llm ? requests * 250 : null,
            quantity: llm ? null : amount(requests * 40_000_000),
            costAmount: unpriced ? null : amount(requests * 3_100),
            unpricedRequests: unpriced ? requests : 0,
          };
        }),
      ),
    });
  }),

  'GET /api/admin/stats/checkin/daily-users': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    return ok({
      items: daysIn(from, to).map((day) => ({
        statDate: day,
        userCount: between(100, 700, 'cu', day),
      })),
    });
  }),

  'GET /api/admin/stats/checkin/streak-buckets': guard('STATS:VIEW', (req) => {
    rangeOf(req);
    return ok({
      items: Array.from({ length: 7 }, (_, i) => ({
        consecutiveDays: i + 1,
        checkinCount: Math.round(900 / (i + 1)),
      })),
    });
  }),

  'GET /api/admin/stats/tasks/summary': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const span = daysIn(from, to).length;
    return ok({
      items: [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const totalRecords = span * between(20, 90, 'tr', i);
        const completedCount = Math.round(totalRecords * (0.4 + unit('cc', i) * 0.5));
        return {
          taskId: `task-${i + 1}`,
          taskName: sampleText(['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'][i] as 'th', i),
          totalRecords,
          completedCount,
          rewardedCount: Math.round(completedCount * 0.9),
          creditsIssued: Math.round(completedCount * 0.9) * 5,
          completionRate: totalRecords === 0 ? null : completedCount / totalRecords,
        };
      }),
    });
  }),

  'GET /api/admin/stats/tasks/daily': guard('STATS:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    return ok({
      items: daysIn(from, to).map((day) => {
        const totalRecords = between(200, 600, 'td', day);
        const completedCount = Math.round(totalRecords * 0.7);
        return {
          statDate: day,
          totalRecords,
          completedCount,
          rewardedCount: Math.round(completedCount * 0.9),
        };
      }),
    });
  }),

  'POST /api/admin/stats/land/:name': guard('STATS:LAND', (req) => {
    const name = req.params.name ?? '';
    if (!(LAND_NAMES as readonly string[]).includes(name)) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such summary');
    }
    const date = text(req.query.date);
    if (!validDay(date) || date > todayOf()) {
      throw invalidRequest('date must be a day up to today (UTC)', [
        { ref: 'date', reason: 'OUT_OF_RANGE' },
      ]);
    }
    // Contract 22.8: `ad-daily` of a day older than the last 7 UTC days leaves the table of the
    // reasons for no ad as it was and says so.
    if (name === 'ad-daily') return ok({ nofillSkipped: date < addDays(todayOf(), -6) });
    return ok(null);
  }),
};
