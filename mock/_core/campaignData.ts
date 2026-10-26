// In-memory state of the campaign endpoints of the mock backend (contract 10.3 to 10.5): campaigns,
// costs, clicks and attribution records. It hangs on `globalThis` like the rest of the mock state
// (see store.ts), so saving a mock file does not lose it; `resetCampaignStore` puts the sample data
// back (the tests call it, a restart does it too). Not a mock file itself: Umi's loader reads every
// file in mock/, and only files that export handlers belong there.

import { multilingualSamples, type SampleLanguage, sampleText } from './fixtures';
import { between, unit } from './statData';
import { store } from './store';

export type MockCampaign = {
  id: string;
  code: string;
  name: string;
  mediaSource: string;
  utmMedium: string;
  campaign: string;
  adset: string | null;
  ad: string | null;
  facebookPixelId: string | null;
  googlePixelId: string | null;
  tiktokPixelId: string | null;
  remark: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  channelCodes: string[];
  /** Kept here and never in an answer: the backend returns only whether it is set. */
  facebookAccessToken: string | null;
  /** The sample campaign that has no traffic at all, so that the pages meet zero denominators. */
  quiet: boolean;
};

export type MockCost = {
  id: string;
  campaignId: string;
  statDate: string;
  amount: number;
  currency: string;
  remark: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MockClick = {
  id: string;
  clickedAt: string;
  campaignId: string;
  status: 'PENDING' | 'MATCHED' | 'EXPIRED';
  channel: 'STORE_REDIRECT' | 'APK_DOWNLOAD';
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  /** The whole address; an answer masks it unless the administrator may see it. */
  ip: string;
  claimedAt: string | null;
};

export type MockRecord = {
  id: string;
  source: 'APPSFLYER' | 'SELF';
  eventName: string;
  eventTime: string;
  conversionType: string | null;
  campaignType: string | null;
  mediaSource: string | null;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  installTime: string | null;
  isRetargeting: boolean | null;
  platform: string | null;
  countryCode: string | null;
  appVersion: string | null;
  cost: number | null;
  costCurrency: string | null;
  costModel: string | null;
  costInSelectedCurrency: number | null;
  accountId: string | null;
  registeredAt: string | null;
  matchType: 'APK_BLOCK' | 'REFERRER' | 'FINGERPRINT' | null;
  attributionCampaignId: string | null;
};

type CampaignStore = {
  campaigns: MockCampaign[];
  costs: MockCost[];
  clicks: MockClick[];
  records: MockRecord[];
  next: { campaign: number; cost: number };
};

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const dayOf = (ms: number) => iso(ms).slice(0, 10);

const LANGUAGES: SampleLanguage[] = ['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'];

// One campaign in each language the product targets. The third is switched off and has no traffic.
const SAMPLE_CAMPAIGNS = [
  { code: 'spring_th', mediaSource: 'facebook', channels: ['play', 'direct'], token: true },
  { code: 'ramadan_ar', mediaSource: 'google', channels: ['play'], token: false },
  { code: 'promo_id', mediaSource: 'tiktok', channels: ['play', 'appstore'], token: false },
  { code: 'summer_vn', mediaSource: 'facebook', channels: [], token: false },
  { code: 'verano_es', mediaSource: 'google', channels: ['direct'], token: true },
  { code: 'launch_en', mediaSource: 'facebook', channels: ['play'], token: false },
  {
    code: 'spring_zh',
    mediaSource: 'tiktok',
    channels: ['play', 'direct', 'appstore'],
    token: false,
  },
] as const;

const NAMES: Record<SampleLanguage, string> = {
  th: 'แคมเปญฤดูใบไม้ผลิ ประเทศไทย',
  ar: 'حملة رمضان للتطبيق',
  id: 'Promo Akhir Tahun Indonesia',
  vi: 'Chiến dịch mùa hè Việt Nam',
  es: 'Campaña de verano ☀️',
  en: 'Launch week (English)',
  zh: '春季推广活动（中文）',
};

const adminId = () => [...store.admins.values()].find((a) => a.username === 'root')?.id ?? '1001';

function seedCampaigns(now: number): MockCampaign[] {
  return SAMPLE_CAMPAIGNS.map((sample, index) => {
    const language = LANGUAGES[index];
    const created = iso(now - (SAMPLE_CAMPAIGNS.length - index) * 2 * DAY_MS);
    return {
      id: String(index + 1),
      code: sample.code,
      name: NAMES[language],
      mediaSource: sample.mediaSource,
      utmMedium: 'cpc',
      campaign: sample.code,
      adset: sampleText(language, 0),
      ad: index % 2 === 0 ? sampleText(language, 1) : null,
      facebookPixelId: sample.mediaSource === 'facebook' ? `FB-${1000 + index}` : null,
      googlePixelId: sample.mediaSource === 'google' ? `G-${2000 + index}` : null,
      tiktokPixelId: sample.mediaSource === 'tiktok' ? `TT-${3000 + index}` : null,
      // One remark is a single string without any space, for the layout of the table.
      remark: index === 4 ? multilingualSamples.longUnbroken : sampleText(language, 2),
      enabled: sample.code !== 'summer_vn',
      createdBy: adminId(),
      createdAt: created,
      updatedAt: created,
      channelCodes: [...sample.channels],
      facebookAccessToken: sample.token ? `mock-token-${index + 1}` : null,
      quiet: sample.code === 'summer_vn',
    };
  });
}

function seedCosts(campaigns: MockCampaign[], now: number): MockCost[] {
  const costs: MockCost[] = [];
  let id = 1;
  for (const campaign of campaigns) {
    if (campaign.quiet) continue;
    for (let back = 0; back < 10; back += 1) {
      // A few days are missing, as they would be in real entry.
      if (unit('cost-gap', campaign.id, back) < 0.12) continue;
      const day = dayOf(now - back * DAY_MS);
      const stamp = `${day}T08:00:00.000Z`;
      costs.push({
        id: String(id++),
        campaignId: campaign.id,
        statDate: day,
        amount: between(2000, 20000, 'cost', campaign.id, day) / 100,
        currency: 'USD',
        remark:
          back % 3 === 0
            ? sampleText(LANGUAGES[(Number(campaign.id) - 1) % LANGUAGES.length], 3)
            : null,
        createdBy: adminId(),
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
  }
  return costs;
}

const CLICK_STATUSES = ['PENDING', 'MATCHED', 'EXPIRED'] as const;

function seedClicks(campaigns: MockCampaign[], now: number): MockClick[] {
  const clicks: MockClick[] = [];
  for (let i = 0; i < 60; i += 1) {
    const campaign = campaigns[i % campaigns.length];
    const clickedAt = now - i * 3.1 * HOUR_MS - 7 * 60_000;
    const status = CLICK_STATUSES[i % 3];
    clicks.push({
      id: String(1000 + 59 - i),
      clickedAt: iso(clickedAt),
      campaignId: campaign.id,
      status,
      channel: i % 2 === 0 ? 'STORE_REDIRECT' : 'APK_DOWNLOAD',
      utmSource: campaign.mediaSource,
      utmMedium: campaign.utmMedium,
      utmCampaign: campaign.campaign,
      ip:
        i % 5 === 4
          ? `2001:db8:85a3::${(0x1000 + i).toString(16)}`
          : `203.0.113.${((i * 7) % 250) + 1}`,
      claimedAt: status === 'MATCHED' ? iso(clickedAt + 20 * 60_000) : null,
    });
  }
  return clicks;
}

const MATCH_TYPES = ['APK_BLOCK', 'REFERRER', 'FINGERPRINT'] as const;
const COUNTRIES = ['TH', 'SA', 'ID', 'VN', 'ES', 'US', 'CN'];
const EXTERNAL_MEDIA = ['facebook', 'google', 'tiktok'];

function seedRecords(campaigns: MockCampaign[], now: number): MockRecord[] {
  const records: MockRecord[] = [];
  for (let i = 0; i < 48; i += 1) {
    const eventMs = now - i * 5.3 * HOUR_MS;
    const own = i % 2 === 0;
    const accountId = i % 4 === 0 ? null : String(20000 + i);
    const base = {
      id: String(5000 + 47 - i),
      eventTime: iso(eventMs),
      countryCode: COUNTRIES[i % COUNTRIES.length],
      appVersion: i % 3 === 0 ? '1.4.2' : '1.5.0',
      accountId,
      registeredAt: accountId ? iso(eventMs + HOUR_MS) : null,
    };
    if (own) {
      const campaign = campaigns[((i / 2) % campaigns.length) | 0];
      records.push({
        ...base,
        source: 'SELF',
        eventName: 'install',
        conversionType: 'install',
        campaignType: null,
        mediaSource: campaign.mediaSource,
        campaign: campaign.campaign,
        adset: campaign.adset,
        ad: campaign.ad,
        installTime: iso(eventMs),
        isRetargeting: false,
        platform: 'ANDROID',
        cost: null,
        costCurrency: null,
        costModel: null,
        costInSelectedCurrency: null,
        matchType: MATCH_TYPES[((i / 2) % 3) | 0],
        attributionCampaignId: campaign.id,
      });
    } else {
      const euro = i % 3 === 0;
      const cost = between(5, 250, 'af-cost', i) / 100;
      records.push({
        ...base,
        source: 'APPSFLYER',
        eventName: i % 8 === 3 ? 'af_app_opened' : 'install',
        conversionType: 'install',
        campaignType: i % 10 === 1 ? 'retargeting' : 'ua',
        mediaSource: EXTERNAL_MEDIA[i % EXTERNAL_MEDIA.length],
        campaign: `af_${EXTERNAL_MEDIA[i % EXTERNAL_MEDIA.length]}_${(i % 4) + 1}`,
        adset: i % 3 === 1 ? sampleText(LANGUAGES[i % 7], 0) : null,
        ad: null,
        installTime: iso(eventMs - (i % 8 === 3 ? DAY_MS : 0)),
        isRetargeting: i % 10 === 1,
        platform: i % 4 === 1 ? 'IOS' : 'ANDROID',
        cost,
        costCurrency: euro ? 'EUR' : 'USD',
        costModel: 'CPI',
        costInSelectedCurrency: Math.round(cost * (euro ? 1.08 : 1) * 100) / 100,
        matchType: null,
        attributionCampaignId: null,
      });
    }
  }
  return records.sort((a, b) => b.eventTime.localeCompare(a.eventTime) || b.id.localeCompare(a.id));
}

function seed(now: Date): CampaignStore {
  const ms = now.getTime();
  const campaigns = seedCampaigns(ms);
  const costs = seedCosts(campaigns, ms);
  return {
    campaigns,
    costs,
    clicks: seedClicks(campaigns, ms),
    records: seedRecords(campaigns, ms),
    next: { campaign: campaigns.length + 1, cost: costs.length + 1 },
  };
}

const holder = globalThis as { __avatarAdminMockCampaign?: CampaignStore };

export const campaignState: CampaignStore = (() => {
  holder.__avatarAdminMockCampaign ??= seed(new Date());
  return holder.__avatarAdminMockCampaign;
})();

export function resetCampaignStore(now: Date = new Date()): void {
  Object.assign(campaignState, seed(now));
}

/** The name of the administrator, read when asked; `null` when the administrator has been deleted. */
export const usernameOf = (id: string | null): string | null =>
  id === null ? null : (store.admins.get(id)?.username ?? null);

/** `203.0.113.7` becomes `203.0.*.*`, an IPv6 address keeps its first two groups. */
export function maskIp(ip: string): string {
  if (!ip.includes(':')) {
    const [a = '', b = ''] = ip.split('.');
    return `${a}.${b}.*.*`;
  }
  const [a = '', b = ''] = ip.split(':');
  return `${a}:${b}:*:*:*:*:*:*`;
}
