// State of the analytics mock: the event log (what the apps sent, in the languages of the target
// markets, signed in and not) and the saved funnels, three of them presets. `resetAnalyticsStore`
// puts the sample data back; both lists live on `globalThis` so saving a mock file keeps them.
import { daysAgoIso, multilingualSamples, SAMPLE_LANGUAGES, sampleText } from './fixtures';

export type AnalyticsEventRow = {
  id: string;
  eventName: string;
  accountId: string | null;
  deviceId: string;
  /** `CLIENT` events came through `POST /api/events`, `SERVER` events were written by the backend. */
  source: 'CLIENT' | 'SERVER';
  params: unknown;
  context: Record<string, unknown> | null;
  clientTime: string | null;
  receivedAt: string;
  /** The place of the event in its batch: batches share one `receivedAt`. */
  seq: number;
  ip: string | null;
  country: string | null;
};

export type SavedFunnelRow = {
  id: string;
  name: string;
  steps: string[];
  windowHours: number;
  isPreset: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type AnalyticsStore = {
  events: AnalyticsEventRow[];
  funnels: SavedFunnelRow[];
  /** How many funnels the (imagined) admin instance is computing now; the mock answers at once, so a test or a hand sets it. */
  funnelInFlight: number;
};

const holder = globalThis as { __avatarAdminMockAnalytics?: AnalyticsStore };
const isFirstLoad = holder.__avatarAdminMockAnalytics === undefined;
holder.__avatarAdminMockAnalytics ??= { events: [], funnels: [], funnelInFlight: 0 };

export const analyticsStore: AnalyticsStore = holder.__avatarAdminMockAnalytics;

/**
 * An IP the way the backend shows it without `ANALYTICS:IP_VIEW`: the last part of an IPv4 address
 * and the second half of an IPv6 address are replaced by `*`.
 */
export function maskIp(ip: string): string {
  if (!ip.includes(':')) {
    const parts = ip.split('.');
    return [...parts.slice(0, -1), '*'].join('.');
  }
  const [head, tail = ''] = ip.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === '' ? [] : tail.split(':');
  const groups = ip.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return [...groups.slice(0, 4), '*', '*', '*', '*'].join(':');
}

const PRESETS: { name: string; steps: string[] }[] = [
  { name: 'Sign-up funnel', steps: ['app_open', 'register_completed'] },
  {
    name: 'Activation funnel',
    steps: ['register_completed', 'avatar_created', 'voice_cloned', 'session_started'],
  },
  {
    name: 'Payment funnel',
    steps: ['paywall_viewed', 'purchase_initiated', 'subscription_started'],
  },
];

const LOCALES = ['th-TH', 'ar-SA', 'id-ID', 'vi-VN', 'es-MX', 'en-US', 'zh-Hans-SG'];
const COUNTRIES = ['TH', 'SA', 'ID', 'VN', 'MX', 'US', 'SG'];
const MODELS = ['Pixel 8', 'SM-S918B', 'Redmi Note 12', 'iPhone 15'];
const uuid = (n: number): string =>
  `7d0c${String(n).padStart(4, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function resetAnalyticsStore(): void {
  const now = Date.now();
  const events: AnalyticsEventRow[] = [];
  let counter = 0;

  const add = (
    hoursAgo: number,
    eventName: string,
    who: { account: string | null; device: number },
    over: Partial<AnalyticsEventRow> = {},
  ) => {
    const k = who.device % LOCALES.length;
    const platform = who.device % 3 === 0 ? 'IOS' : 'ANDROID';
    const receivedAt = new Date(now - Math.max(0, hoursAgo) * 3600000 - counter).toISOString();
    events.push({
      id: String(70000 + counter),
      eventName,
      accountId: who.account,
      deviceId: uuid(who.device),
      source: 'CLIENT',
      params: null,
      context: {
        platform,
        appVersion: `1.${who.device % 4}.${who.device % 7}`,
        osVersion: platform === 'IOS' ? '17.5' : '14',
        deviceModel: MODELS[who.device % MODELS.length],
        locale: LOCALES[k],
        network: who.device % 2 ? 'WIFI' : 'CELLULAR',
      },
      clientTime: new Date(Date.parse(receivedAt) - 1500 + (who.device % 5) * 700).toISOString(),
      receivedAt,
      seq: 0,
      ip:
        who.device % 9 === 4
          ? `2001:db8:${(0xa000 + who.device).toString(16)}:0:0:8a2e:370:7334`
          : `203.0.${113 + (who.device % 3)}.${10 + (who.device % 200)}`,
      country: COUNTRIES[k],
      ...over,
    });
    counter += 1;
  };

  // 60 people who installed, opened the app (before signing up they had no account), signed up and
  // went further: fewer and fewer at each step.
  for (let i = 0; i < 60; i += 1) {
    const account = String(2000 + i);
    const age = (i % 9) * 24 + 4 + (i % 17);
    if (i % 2 === 0) add(age + 0.5, 'app_open', { account: null, device: i });
    add(
      age,
      'register_completed',
      { account, device: i },
      { params: { method: ['email', 'google', 'apple', 'phone'][i % 4] } },
    );
    add(age - 0.1, 'app_open', { account, device: i });
    if (i % 3 !== 0)
      add(age - 0.2, 'avatar_created', { account, device: i }, { params: { taskId: `t-${i}` } });
    if (i % 3 === 1)
      add(age - 0.3, 'voice_cloned', { account, device: i }, { params: { taskId: `v-${i}` } });
    if (i % 3 === 1 && i % 2 === 0) {
      add(
        age - 0.4,
        'session_started',
        { account, device: i },
        { params: { sessionId: `s-${i}` } },
      );
      add(
        age - 0.5,
        'session_ended',
        { account, device: i },
        { params: { sessionId: `s-${i}`, durationSec: 30 + i } },
      );
    }
    if (i % 4 === 0)
      add(
        age - 1,
        'paywall_viewed',
        { account, device: i },
        { params: { placement: 'call_limit' } },
      );
    if (i % 8 === 0)
      add(
        age - 1.1,
        'purchase_initiated',
        { account, device: i },
        { params: { kind: 'subscription', store: 'PLAY', productId: 'pro_month' } },
      );
    if (i % 16 === 0)
      add(
        age - 1.2,
        'subscription_started',
        { account, device: i },
        {
          source: 'SERVER',
          ip: null,
          country: null,
          context: null,
          clientTime: null,
          params: { store: 'PLAY', productId: 'pro_month' },
        },
      );
    add(age - 2, 'app_foreground', { account, device: i });
    add(
      age - 2.1,
      'message_sent',
      { account, device: i },
      { params: { sessionId: null, channel: 'text' } },
    );
  }

  // 15 devices that opened the app and left without signing up.
  for (let i = 100; i < 115; i += 1) {
    add(2 + (i % 11) * 24 + (i % 5), 'app_open', { account: null, device: i });
    if (i % 2)
      add(
        1 + (i % 11) * 24,
        'login_page_view',
        { account: null, device: i },
        { params: { method: 'entry' } },
      );
  }

  // Texts in every language of the target markets, a 5000 character string without a space and emoji.
  SAMPLE_LANGUAGES.forEach((language, index) => {
    add(
      3 + index,
      'push_opened',
      { account: String(2000 + index), device: index },
      {
        params: {
          pushId: `p-${index}`,
          pushType: 'RECALL',
          title: sampleText(language, 0),
          body: sampleText(language, 3),
        },
      },
    );
  });
  add(
    5,
    'experiment_assigned',
    { account: '2003', device: 3 },
    { params: { experiment: 'long', group: 'ก็'.repeat(2500) } },
  );
  add(
    6,
    'experiment_assigned',
    { account: '2004', device: 4 },
    { params: { experiment: multilingualSamples.edgeCases[1], group: '😀'.repeat(60) } },
  );
  add(
    7,
    'app_background',
    { account: '2005', device: 5 },
    { params: { durationSec: 3600 }, clientTime: null },
  );
  // The app's clock was a day ahead: the client time cannot be trusted, the received time can.
  add(8, 'app_open', { account: '2006', device: 6 }, { clientTime: daysAgoIso(-1) });

  // Forty names that came up once, so the name list needs more than one page of 50.
  for (let n = 1; n <= 40; n += 1) {
    add(1 + n * 0.1, `custom_probe_${String(n).padStart(2, '0')}`, {
      account: String(2000 + (n % 60)),
      device: n % 60,
    });
  }

  events.sort((a, b) =>
    a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : a.seq - b.seq,
  );
  analyticsStore.events = events;
  analyticsStore.funnelInFlight = 0;

  const created = daysAgoIso(30);
  analyticsStore.funnels = PRESETS.map((preset, i) => ({
    id: String(100 + i),
    name: preset.name,
    steps: preset.steps,
    windowHours: 24,
    isPreset: true,
    createdBy: null,
    createdAt: created,
    updatedAt: created,
  }));
}

if (isFirstLoad) resetAnalyticsStore();
