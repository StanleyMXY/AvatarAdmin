// The registry and the stored values of the client configuration endpoints of the mock backend
// (contract 26.2, backend reply 2 item 1). The keys are declared here, in code, as the contract
// says; the six read-only keys take their value from the system configuration of the mock backend.
// It hangs on `globalThis` like the rest of the mock state (see store.ts). Not a mock file itself:
// Umi's loader reads every file in mock/.
import { currentValue } from './configStore';

export type MockType = 'URL' | 'EMAIL' | 'STRING' | 'BOOLEAN' | 'INT' | 'STRING_LIST';

export type MockKey = {
  key: string;
  type: MockType;
  localized: boolean;
  defaultValue: string | number | boolean | null;
  /** The system configuration key a read-only key takes its value from. */
  source?: string;
  /** What the mock backend refuses besides the type (the real limits are the backend's). */
  maxLength?: number;
  range?: [number, number];
  placeholders?: string[];
  noQuery?: boolean;
};

export const REGISTRY: MockKey[] = [
  { key: 'privacyPolicyUrl', type: 'URL', localized: true, defaultValue: null },
  { key: 'termsOfServiceUrl', type: 'URL', localized: true, defaultValue: null },
  { key: 'communityGuidelinesUrl', type: 'URL', localized: true, defaultValue: null },
  { key: 'supportUrl', type: 'URL', localized: true, defaultValue: null },
  { key: 'supportEmail', type: 'EMAIL', localized: false, defaultValue: null },
  { key: 'accountDeletionUrl', type: 'URL', localized: true, defaultValue: null },
  { key: 'inviteLinkBase', type: 'URL', localized: false, defaultValue: null, noQuery: true },
  {
    key: 'inviteShareText',
    type: 'STRING',
    localized: true,
    defaultValue: null,
    maxLength: 500,
    placeholders: ['link', 'code'],
  },
  { key: 'inviteShareTitle', type: 'STRING', localized: true, defaultValue: null, maxLength: 200 },
  {
    key: 'phoneLoginEnabled',
    type: 'BOOLEAN',
    localized: false,
    defaultValue: null,
    source: 'auth.phone_login_enabled',
  },
  {
    key: 'accountDeletionGraceDays',
    type: 'INT',
    localized: false,
    defaultValue: null,
    source: 'deletion.grace_days',
  },
  {
    key: 'conversationLanguages',
    type: 'STRING_LIST',
    localized: false,
    defaultValue: null,
    source: 'chat.conversation_languages',
  },
  {
    key: 'voiceTranscriptMaxChars',
    type: 'INT',
    localized: false,
    defaultValue: null,
    source: 'voice.transcript_max_chars',
  },
  {
    key: 'voiceMinSeconds',
    type: 'INT',
    localized: false,
    defaultValue: null,
    source: 'generation.voice_min_seconds',
  },
  {
    key: 'voiceMaxSeconds',
    type: 'INT',
    localized: false,
    defaultValue: null,
    source: 'generation.voice_max_seconds',
  },
  { key: 'drivingLookaheadMs', type: 'INT', localized: false, defaultValue: 200, range: [0, 5000] },
  {
    key: 'renderTierLocalMinFps',
    type: 'INT',
    localized: false,
    defaultValue: 25,
    range: [1, 120],
  },
  {
    key: 'renderTierMaxMemoryMb',
    type: 'INT',
    localized: false,
    defaultValue: 512,
    range: [64, 16384],
  },
  { key: 'avatarCacheMaxMb', type: 'INT', localized: false, defaultValue: 500, range: [50, 10240] },
];

export type MockRow = { value: unknown; updatedBy: string; updatedAt: string };

type ClientConfigStore = { rows: Map<string, Map<string, MockRow>> };

const holder = globalThis as { __avatarAdminMockClientConfig?: ClientConfigStore };
holder.__avatarAdminMockClientConfig ??= { rows: new Map() };

export const clientConfigState: ClientConfigStore = holder.__avatarAdminMockClientConfig;

export const keyOf = (key: string): MockKey | undefined => REGISTRY.find((k) => k.key === key);

/** The value of a read-only key: whatever the system configuration holds now. */
export const systemValue = (def: MockKey): unknown =>
  def.source === undefined ? null : currentValue(def.source);

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** The newest `updatedAt` among the rows of a key; null when it has none (the contract's "time of the key"). */
export const latestUpdatedAt = (key: string): string | null => {
  const rows = [...(clientConfigState.rows.get(key)?.values() ?? [])];
  return rows.reduce<string | null>(
    (newest, row) => (newest === null || row.updatedAt > newest ? row.updatedAt : newest),
    null,
  );
};

/** A time after `after`, also when the clock has not moved since: two saves never share one. */
export const instantAfter = (after: string | null): string =>
  new Date(Math.max(Date.now(), after === null ? 0 : Date.parse(after) + 1)).toISOString();

/**
 * What a test does to stand in for a second administrator who saved the key after the first one
 * opened it: replaces every language of the key with `values`, as a real save would, and returns
 * the new time of the key. `byAdminId` defaults to the preset `support` administrator.
 */
export function simulateOtherAdminEdit(
  key: string,
  values: Record<string, unknown>,
  byAdminId = '1002',
): string {
  const updatedAt = instantAfter(latestUpdatedAt(key));
  clientConfigState.rows.set(
    key,
    new Map(
      Object.entries(values).map(([locale, value]) => [
        locale,
        { value, updatedBy: byAdminId, updatedAt },
      ]),
    ),
  );
  return updatedAt;
}

export function resetClientConfigStore(): void {
  clientConfigState.rows = new Map();
  const put = (key: string, locale: string, value: unknown, days: number) => {
    const rows = clientConfigState.rows.get(key) ?? new Map<string, MockRow>();
    rows.set(locale, { value, updatedBy: '1001', updatedAt: ago(days) });
    clientConfigState.rows.set(key, rows);
  };
  // Links in the seven languages of the product: the default and a few languages.
  put('privacyPolicyUrl', '', 'https://example.com/privacy', 9);
  put('privacyPolicyUrl', 'th', 'https://example.com/th/privacy', 8);
  put('privacyPolicyUrl', 'ar', 'https://example.com/ar/privacy', 7);
  put('privacyPolicyUrl', 'zh-Hans', 'https://example.com/zh/privacy', 6);
  put('termsOfServiceUrl', '', 'https://example.com/terms', 5);
  put('supportEmail', '', 'help@example.com', 4);
  // Text in several languages, with placeholders, emoji and a long unbroken string.
  put('inviteShareTitle', '', 'Join me on the app 🎉', 3);
  put('inviteShareTitle', 'th', 'มาใช้แอปด้วยกันนะ 😀', 3);
  put('inviteShareTitle', 'ar', 'انضم إلي في التطبيق 🌟', 3);
  put('inviteShareTitle', 'id', 'Ayo gabung denganku', 3);
  put('inviteShareTitle', 'vi', 'Tham gia cùng tôi nhé', 3);
  put('inviteShareTitle', 'es', 'Únete a mí en la app', 3);
  put('inviteShareText', '', 'Use my code {code} here: {link}', 2);
  put('inviteShareText', 'th', `ใช้รหัส {code} ที่นี่ ${'ก็'.repeat(40)} {link}`, 2);
}

resetClientConfigStore();
