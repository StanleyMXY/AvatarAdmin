import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore, saved } from '../../mock/_core/configStore';
import { daysIn } from '../../mock/_core/statRange';
import { resetStore } from '../../mock/_core/store';
import activity from '../../mock/activity.mock';
import ads from '../../mock/ads.mock';
import authMock from '../../mock/auth.mock';
import campaign from '../../mock/campaign.mock';
import configMock from '../../mock/config.mock';
import cost from '../../mock/cost.mock';
import credits from '../../mock/credits.mock';
import invite from '../../mock/invite.mock';
import moderation from '../../mock/moderation.mock';
import push from '../../mock/push.mock';
import sessions from '../../mock/sessions.mock';
import stats from '../../mock/stats.mock';
import subscriptions from '../../mock/subscriptions.mock';
import { useMockBackend } from '../../tests/mockBackend';
import { renderPage } from '../../tests/renderPage';
import { signInAsAdmin } from '../../tests/signInAsAdmin';
import { resetUmiStub } from '../../tests/stubs/umi-max';
import SigninStatsPage from './activity/signinStats';
import TaskStatsPage from './activity/taskStats';
import AdReportPage from './ads/report';
import { SummaryTab } from './campaign/SummaryTab';
import CampaignStatsPage from './campaign/stats';
import CostReportPage from './cost/report';
import CreditStatsPage from './credits/stats';
import ShareStatsPage from './invite/shareStats';
import InviteStatsPage from './invite/stats';
import ModerationStatsPage from './moderation/stats';
import PushStatsPage from './push/stats';
import CallAnalyticsPage from './sessions/analytics';
import SessionQualityPage from './sessions/quality';
import DailyPage from './stat/daily';
import { GuestCohortTab } from './stat/guest/GuestCohortTab';
import { GuestDailyTab } from './stat/guest/GuestDailyTab';
import { GuestQuotaTab } from './stat/guest/GuestQuotaTab';
import { GuestRetentionTab } from './stat/guest/GuestRetentionTab';
import RetentionPage from './stat/retention';
import SubscriptionStatsPage from './subscriptions/stats';

// Contract 17.6: every statistics endpoint refuses a range the same way (400 INVALID_REQUEST with
// `from` or `to` as the ref). Here the fake backend refuses the first range each page asks for (the
// page was not told the limit, which the key `stats.max_range_days` now holds as 3 days), and the
// page must write the refusal under its date picker in the words of the code, not the backend's.

const tab = { landedTick: 0, onLanded: () => {} };
const PAGES: [string, () => ReactElement][] = [
  ['daily report', () => <DailyPage />],
  ['retention', () => <RetentionPage />],
  ['guest daily', () => <GuestDailyTab {...tab} />],
  ['guest cohort', () => <GuestCohortTab {...tab} />],
  ['guest retention', () => <GuestRetentionTab {...tab} />],
  ['guest allowance', () => <GuestQuotaTab />],
  ['call quality', () => <SessionQualityPage />],
  ['call analytics', () => <CallAnalyticsPage />],
  ['push statistics', () => <PushStatsPage />],
  ['credit statistics', () => <CreditStatsPage />],
  ['subscription statistics', () => <SubscriptionStatsPage />],
  ['moderation statistics', () => <ModerationStatsPage />],
  ['invite statistics', () => <InviteStatsPage />],
  ['share statistics', () => <ShareStatsPage />],
  ['ad report', () => <AdReportPage />],
  ['cost report', () => <CostReportPage />],
  ['campaign performance', () => <CampaignStatsPage />],
  ['attribution summary', () => <SummaryTab kept={{ current: {} } as never} />],
  ['sign-in statistics', () => <SigninStatsPage />],
  ['task statistics', () => <TaskStatsPage />],
];

// The fake backend holds the limit of 3 days. `meta` is what `GET /meta` told the page about it.
function start(meta: Record<string, unknown>) {
  resetUmiStub();
  resetStore();
  signInAsAdmin('root', { meta });
  saved.set('stats.max_range_days', {
    value: 3,
    updatedAt: 'x',
    updatedBy: '1',
    updatedByUsername: 'root',
  });
}
const MOCKS = [
  { default: authMock },
  { default: configMock },
  { default: stats },
  { default: credits },
  { default: subscriptions },
  { default: moderation },
  { default: invite },
  { default: ads },
  { default: cost },
  { default: campaign },
  { default: push },
  { default: sessions },
  { default: activity },
];
afterEach(() => {
  resetConfigStore();
  vi.unstubAllGlobals();
});

describe('a range the backend refuses is written under the date picker', { timeout: 60000 }, () => {
  it.each(PAGES)('%s: the end date, in English', async (_name, page) => {
    start({});
    useMockBackend(...MOCKS);
    renderPage(page());
    const line = await screen.findByTestId('stat-range-error', {}, { timeout: 20000 });
    expect(line.textContent).toMatch(
      /^End date: .*outside the allowed range.*stats\.max_range_days/,
    );
    expect(document.body.textContent).not.toContain('The range exceeds');
    expect(document.querySelector('.ant-picker-status-error')).not.toBeNull();
  });

  it.each([
    ['daily report', () => <DailyPage />],
    ['credit statistics', () => <CreditStatsPage />],
    ['ad report', () => <AdReportPage />],
  ] as [string, () => ReactElement][])('%s: and in Chinese', async (_name, page) => {
    start({});
    useMockBackend(...MOCKS);
    renderPage(page(), 'zh-CN');
    const line = await screen.findByTestId('stat-range-error', {}, { timeout: 20000 });
    expect(line.textContent).toMatch(/^结束日期：.*超出允许的范围/);
  });
});

// The first range of a page keeps within the limit the page was told, so the first read is not refused.
describe('the first range stays within the limit the page was told', { timeout: 60000 }, () => {
  it.each(PAGES.filter(([name]) => name !== 'attribution summary'))(
    '%s asks for at most 3 days and is not refused',
    async (_name, page) => {
      start({ statsMaxRangeDays: 3 });
      const calls = useMockBackend(...MOCKS);
      renderPage(page());
      await waitFor(
        () =>
          expect(calls.some((c) => /[?&]from=/.test(c.url) && /[?&]to=/.test(c.url))).toBe(true),
        { timeout: 20000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      for (const call of calls) {
        const query = new URL(call.url, 'http://x').searchParams;
        const [from, to] = [query.get('from'), query.get('to')];
        if (from === null || to === null || !/^\d{4}-\d{2}-\d{2}$/.test(from)) continue;
        expect(daysIn(from, to).length, call.url).toBeLessThanOrEqual(3);
      }
      expect(screen.queryByTestId('stat-range-error')).toBeNull();
    },
  );
});
