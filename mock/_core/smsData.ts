// In-memory state of the SMS endpoints of the mock backend (contract 23.4 and 23.6): channels,
// templates and send records. It hangs on `globalThis` like the rest of the mock state (see
// store.ts), so saving a mock file does not lose it; `resetSmsStore` puts the sample data back (the
// tests call it, a restart does it too). Not a mock file itself: Umi's loader reads every file in
// mock/, and only files that export handlers belong there.
//
// A channel keeps its credentials here, in `credentials`, and nothing that answers a request ever
// copies that field: the answers have `hasCredentials` only.

import type {
  DeliveryChannel,
  DeliveryStatus,
  RecordPurpose,
  SendStatus,
  SmsType,
} from '../../src/services/sms/types';
import { multilingualSamples } from './fixtures';

export type MockChannel = {
  id: string;
  channelCode: string;
  name: string;
  providerCode: string;
  apiUrl: string;
  /** The secret. Never in an answer. */
  /** Names to text values (the backend takes a map); null when there are none. Never copied into an answer. */
  credentials: Record<string, string> | null;
  extConfig: Record<string, unknown> | null;
  countries: string[];
  smsType: SmsType;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type MockTemplate = {
  id: string;
  templateCode: string;
  name: string;
  locale: string;
  country: string | null;
  content: string;
  providerTemplateId: string | null;
  smsType: SmsType;
  enabled: boolean;
};

/** A record with the whole number; the endpoints mask it for an administrator without SMS:RECORD:PHONE_VIEW. */
export type MockRecord = {
  msgId: string;
  channel: DeliveryChannel;
  vendorMsgId: string | null;
  channelCode: string;
  purpose: RecordPurpose;
  mobile: string;
  country: string | null;
  localeUsed: string | null;
  templateCode: string | null;
  contentRedacted: string;
  sendStatus: SendStatus;
  deliveryStatus: DeliveryStatus;
  failReason: string | null;
  usedAt: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
};

export type SmsStore = {
  channels: Map<string, MockChannel>;
  templates: Map<string, MockTemplate>;
  /** Newest first. */
  records: MockRecord[];
  next: { channel: number; template: number; record: number };
  /** The test sends of each administrator on one UTC day. */
  testUsed: Map<string, { day: string; count: number }>;
  /** How many accounts sign in with a phone number: the backend refuses to remove the last OTP channel while there are some. */
  phoneAccounts: number;
};

/** The registered providers and the hosts their addresses may use (names are made up; none is a real service). */
export const SMS_PROVIDERS = [
  { code: 'gateway-a', allowedHosts: ['sms.example.com', 'api.sms-a.example.net'] },
  { code: 'gateway-b', allowedHosts: ['gw.example.org'] },
  { code: 'test-stub', allowedHosts: ['stub.example.com'] },
];

/** `sms.test_per_day`. */
export const TEST_PER_DAY = 5;

const DAY = 86_400_000;
const MINUTE = 60_000;
const iso = (ms: number): string => new Date(ms).toISOString();

function seedChannels(ms: number): MockChannel[] {
  const rows: Omit<MockChannel, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      channelCode: 'gw_th_otp',
      name: multilingualSamples.th[0],
      providerCode: 'gateway-a',
      apiUrl: 'https://sms.example.com/v1/send',
      credentials: { apiKey: 'seed-secret-1' },
      extConfig: { appId: 'app-th', senderIds: { TH: 'AVATAR' } },
      countries: ['TH'],
      smsType: 'OTP',
      enabled: true,
      priority: 10,
    },
    {
      channelCode: 'gw_sea_otp',
      name: multilingualSamples.id[0],
      providerCode: 'gateway-b',
      apiUrl: 'https://gw.example.org/api/otp',
      credentials: { apiKey: 'seed-secret-2' },
      extConfig: { appId: 'app-sea', senderIds: { ID: 'AVATAR', VN: 'AVATAR' } },
      countries: ['ID', 'VN'],
      smsType: 'OTP',
      enabled: true,
      priority: 20,
    },
    {
      channelCode: 'gw_ar_otp',
      name: multilingualSamples.ar[0],
      providerCode: 'gateway-a',
      apiUrl: 'https://api.sms-a.example.net/send',
      credentials: { apiKey: 'seed-secret-3' },
      extConfig: null,
      countries: ['SA', 'AE', 'EG'],
      smsType: 'OTP',
      enabled: true,
      priority: 30,
    },
    {
      channelCode: 'gw_es_promo',
      name: multilingualSamples.es[0],
      providerCode: 'gateway-b',
      apiUrl: 'https://gw.example.org/api/promo',
      credentials: null,
      extConfig: { appId: 'app-es' },
      countries: [],
      smsType: 'MARKETING',
      enabled: false,
      priority: 50,
    },
    {
      channelCode: 'gw_all_backup',
      name: multilingualSamples.longUnbroken,
      providerCode: 'test-stub',
      apiUrl: 'https://stub.example.com/send',
      credentials: { apiKey: 'seed-secret-5' },
      extConfig: null,
      countries: [],
      smsType: 'OTP',
      enabled: false,
      priority: 90,
    },
  ];
  return rows.map((row, i) => ({
    ...row,
    id: String(i + 1),
    createdAt: iso(ms - (40 - i * 3) * DAY),
    updatedAt: iso(ms - (10 - i) * DAY),
  }));
}

function seedTemplates(): MockTemplate[] {
  const otp = (
    templateCode: string,
    name: string,
    locale: string,
    country: string | null,
    content: string,
    providerTemplateId: string | null = null,
  ): Omit<MockTemplate, 'id'> => ({
    templateCode,
    name,
    locale,
    country,
    content,
    providerTemplateId,
    smsType: 'OTP',
    enabled: true,
  });
  const rows: Omit<MockTemplate, 'id'>[] = [
    otp(
      'otp_en',
      'English',
      'en',
      null,
      'Your {appName} code is {code}. It expires in {minutes} minutes. 🚀',
    ),
    otp(
      'otp_th',
      'ไทย',
      'th',
      'TH',
      'รหัส {appName} ของคุณคือ {code} ใช้ได้ภายใน {minutes} นาที',
      'TPL-TH-1',
    ),
    otp(
      'otp_ar',
      'العربية',
      'ar',
      null,
      'رمز {appName} الخاص بك هو {code} صالح لمدة {minutes} دقائق',
    ),
    otp(
      'otp_id',
      'Indonesia',
      'id',
      'ID',
      'Kode {appName} Anda adalah {code}. Berlaku {minutes} menit.',
    ),
    otp(
      'otp_vi',
      'Tiếng Việt',
      'vi',
      'VN',
      'Mã {appName} của bạn là {code}. Có hiệu lực trong {minutes} phút.',
    ),
    otp(
      'otp_es',
      'Español',
      'es',
      null,
      '¡Su código de {appName} es {code}! Válido {minutes} minutos.',
    ),
    otp(
      'otp_zh',
      '简体中文',
      'zh-Hans',
      'CN',
      '你的 {appName} 验证码是 {code}，{minutes} 分钟内有效。',
    ),
    {
      templateCode: 'promo_en',
      name: 'Promotion',
      locale: 'en',
      country: null,
      content: 'Sale today only!',
      providerTemplateId: null,
      smsType: 'MARKETING',
      enabled: false,
    },
    {
      ...otp('otp_long', 'ก'.repeat(120), 'th', null, `{code}${'ก'.repeat(5000)}`),
      enabled: false,
    },
  ];
  return rows.map((row, i) => ({ ...row, id: String(i + 1) }));
}

// ---- the records ----

const LANGUAGES = [
  { locale: 'th', country: 'TH', prefix: '+6681234', text: 'รหัส OTP ของคุณคือ **** ใช้ได้ภายใน 5 นาที' },
  {
    locale: 'ar',
    country: 'SA',
    prefix: '+9665123',
    text: 'رمز التحقق الخاص بك هو **** صالح لمدة 5 دقائق',
  },
  {
    locale: 'id',
    country: 'ID',
    prefix: '+62812345',
    text: 'Terima kasih. Kode OTP Anda adalah ****. Berlaku 5 menit.',
  },
  {
    locale: 'vi',
    country: 'VN',
    prefix: '+8491234',
    text: 'Mã OTP của bạn là ****. Có hiệu lực trong 5 phút.',
  },
  {
    locale: 'es',
    country: 'ES',
    prefix: '+3461234',
    text: '¿Su código es ****? Válido 5 minutos. ¡Gracias!',
  },
  {
    locale: 'en',
    country: 'US',
    prefix: '+141555',
    text: 'Your code is ****. It expires in 5 minutes. 🚀',
  },
  {
    locale: 'zh-Hans',
    country: 'CN',
    prefix: '+861381234',
    text: '你的验证码是 ****，5 分钟内有效。',
  },
];
const PURPOSES: RecordPurpose[] = [
  'LOGIN',
  'LOGIN',
  'LOGIN',
  'DELETE',
  'LOGIN',
  'EXPORT',
  'DELETE_WEB',
];
const CHANNEL_OF_COUNTRY: Record<string, string> = {
  TH: 'gw_th_otp',
  SA: 'gw_ar_otp',
  ID: 'gw_sea_otp',
  VN: 'gw_sea_otp',
  ES: 'gw_all_backup',
  US: 'gw_all_backup',
  CN: 'gw_all_backup',
};
const TEMPLATE_OF_LOCALE: Record<string, string> = {
  th: 'otp_th',
  ar: 'otp_ar',
  id: 'otp_id',
  vi: 'otp_vi',
  es: 'otp_es',
  en: 'otp_en',
  'zh-Hans': 'otp_zh',
};

const RECORD_COUNT = 45;

function seedRecords(ms: number): MockRecord[] {
  const rows: MockRecord[] = [];
  for (let i = 0; i < RECORD_COUNT; i += 1) {
    const lang = LANGUAGES[i % LANGUAGES.length];
    const createdMs = ms - (i + 1) * 41 * MINUTE;
    const failed = i % 9 === 4;
    const sending = !failed && i % 11 === 10;
    const sendStatus: SendStatus = failed ? 'FAILED' : sending ? 'SENDING' : 'SUCCESS';
    let purpose = PURPOSES[i % PURPOSES.length];
    const push = i % 6 === 2 && !failed;
    if (push && purpose === 'DELETE_WEB') purpose = 'LOGIN';
    const channel: DeliveryChannel = push ? 'PUSH' : 'SMS';
    const delivery: DeliveryStatus = push
      ? 'NOT_APPLICABLE'
      : failed
        ? 'FAILED'
        : sending
          ? 'PENDING'
          : i % 3 === 0
            ? 'PENDING'
            : 'DELIVERED';
    const used = sendStatus === 'SUCCESS' && i % 3 === 0;
    rows.push({
      msgId: `00000000-0000-4000-8000-${String(RECORD_COUNT - i).padStart(12, '0')}`,
      channel,
      vendorMsgId: push || sending ? null : `V-${String(70000 + i * 13)}`,
      channelCode: push ? 'push' : (CHANNEL_OF_COUNTRY[lang.country] ?? 'gw_th_otp'),
      purpose,
      mobile: `${lang.prefix}${String(1000 + i * 37).slice(-4)}`,
      country: lang.country,
      localeUsed: lang.locale,
      templateCode: push ? null : (TEMPLATE_OF_LOCALE[lang.locale] ?? null),
      contentRedacted: i === 7 ? `${lang.text}${'ก'.repeat(5000)}` : lang.text,
      sendStatus,
      deliveryStatus: delivery,
      failReason: failed
        ? i === 4
          ? 'E'.repeat(5000)
          : i % 2 === 0
            ? 'TIMEOUT'
            : 'Provider rejected the number'
        : null,
      usedAt: used ? iso(createdMs + 40_000) : null,
      createdAt: iso(createdMs),
      sentAt: sending || failed ? null : iso(createdMs + 1500),
      deliveredAt: delivery === 'DELIVERED' ? iso(createdMs + 4000) : null,
    });
  }
  return rows;
}

const byId = <T extends { id: string }>(rows: T[]): Map<string, T> =>
  new Map(rows.map((row) => [row.id, row]));

function seed(now: Date): SmsStore {
  const ms = now.getTime();
  const channels = seedChannels(ms);
  const templates = seedTemplates();
  return {
    channels: byId(channels),
    templates: byId(templates),
    records: seedRecords(ms),
    next: {
      channel: channels.length + 1,
      template: templates.length + 1,
      record: RECORD_COUNT + 1,
    },
    testUsed: new Map(),
    phoneAccounts: 3,
  };
}

const holder = globalThis as { __avatarAdminMockSms?: SmsStore };

export const smsState: SmsStore = (() => {
  holder.__avatarAdminMockSms ??= seed(new Date());
  return holder.__avatarAdminMockSms;
})();

export function resetSmsStore(now: Date = new Date()): void {
  Object.assign(smsState, seed(now));
}
