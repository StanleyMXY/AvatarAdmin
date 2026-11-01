import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsMock from '../../mock/analytics.mock';
import campaignMock from '../../mock/campaign.mock';
import configMock from '../../mock/config.mock';
import * as costMock from '../../mock/cost.mock';
import * as inviteMock from '../../mock/invite.mock';
import statsMock from '../../mock/stats.mock';
import * as subscriptionsMock from '../../mock/subscriptions.mock';
import { useMockBackend } from '../../tests/mockBackend';
import { renderPage } from '../../tests/renderPage';
import SummaryPage from './analytics/summary';
import { VIEW as ANALYTICS_VIEW, signIn as analyticsSignIn } from './analytics/testSetup';
import CampaignStatsPage from './campaign/stats';
import { signIn as campaignSignIn } from './campaign/testSetup';
import { CurrentTab } from './cost/CurrentTab';
import { ModelsTab } from './cost/ModelsTab';
import CostReportPage from './cost/report';
import { signIn as costSignIn } from './cost/testSetup';
import { InviteOverview } from './invite/InviteOverview';
import ShareStatsPage from './invite/shareStats';
import { signIn as inviteSignIn } from './invite/testSetup';
import SubscriptionStatsPage from './subscriptions/stats';

// Spec section 12: every list page shows a loading state while its rows are read. The report pages
// draw their tables from a read of their own, so the table has no `loading` of its own; the page
// shows a spinner until the answer is there. Each case holds back every request, looks for the
// spinner (with no table rows yet), lets the answers through, and looks for the rows and no spinner.
const NOW = new Date('2026-10-26T10:00:00Z');

const spinning = () => document.querySelector('.ant-spin-spinning') !== null;
const rows = () => document.querySelectorAll('tbody tr.ant-table-row').length;

let release: () => void = () => {};
/** Puts a gate in front of whatever `fetch` is now: no request is answered before `release()`. */
function holdAllReads() {
  const real = globalThis.fetch;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) => open.then(() => real(...args)));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  release();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Case = {
  name: string;
  setup: () => void;
  ui: () => ReactElement;
  /** Opens what has to be open before the table is there (a tab). */
  open?: () => void;
};

const cases: Case[] = [
  {
    name: 'the event summary',
    setup: () => {
      analyticsSignIn('support', { codes: ANALYTICS_VIEW });
      useMockBackend(analyticsMock);
    },
    ui: () => <SummaryPage />,
  },
  {
    name: 'the attribution statistics',
    setup: () => {
      campaignSignIn('root');
      useMockBackend({ default: campaignMock }, { default: configMock }, { default: statsMock });
    },
    ui: () => <CampaignStatsPage />,
  },
  {
    name: 'the cost report',
    setup: () => {
      costSignIn('root', { meta: { allowedCurrencies: ['USD'] } });
      useMockBackend(costMock, { default: statsMock });
    },
    ui: () => <CostReportPage />,
  },
  {
    name: 'the current prices',
    setup: () => {
      costSignIn('root', { meta: { allowedCurrencies: ['USD'] } });
      useMockBackend(costMock);
    },
    ui: () => <CurrentTab />,
  },
  {
    name: 'the prices by model',
    setup: () => {
      costSignIn('root', { meta: { allowedCurrencies: ['USD'] } });
      useMockBackend(costMock);
    },
    ui: () => <ModelsTab onlyUnpricedInitially={false} />,
  },
  {
    name: 'the invite overview',
    setup: () => {
      inviteSignIn('root', { meta: { inviteChainMaxDepth: 5 } });
      useMockBackend(inviteMock);
    },
    ui: () => (
      <InviteOverview
        query={{ from: '2026-10-20', to: '2026-10-26', limit: 10 }}
        onViewFission={() => {}}
      />
    ),
  },
  {
    name: 'the share channels',
    setup: () => {
      inviteSignIn('root', { meta: {} });
      useMockBackend(inviteMock);
    },
    ui: () => <ShareStatsPage />,
    open: () => fireEvent.click(screen.getByRole('tab', { name: 'Channels' })),
  },
  {
    name: 'the subscription statistics',
    setup: () => {
      analyticsSignIn('root');
      useMockBackend(subscriptionsMock);
    },
    ui: () => <SubscriptionStatsPage />,
  },
];

describe.each(cases)('$name', ({ setup, ui, open }) => {
  it('shows a spinner and no rows while the read is out, and the rows and no spinner when it is back', async () => {
    setup();
    holdAllReads();
    renderPage(ui());
    open?.();
    await waitFor(() => expect(spinning()).toBe(true));
    expect(rows()).toBe(0);
    await act(async () => release());
    await waitFor(() => expect(rows()).toBeGreaterThan(0));
    await waitFor(() => expect(spinning()).toBe(false));
  });
});
