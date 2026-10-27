// In-memory state of the content moderation endpoints of the mock backend: the records, what was
// reviewed (text or a file), the rule list, the signed addresses that were handed out and the
// views that the backend would write to its audit log. It hangs on `globalThis` like the rest of
// the mock state (see store.ts), so saving a mock file does not lose it; `resetModerationStore`
// puts the sample data back.
// Not a mock file itself: Umi's loader reads every file in mock/, and only files that export
// handlers belong there, so this one lives in _core/.
import { multilingualSamples, SAMPLE_LANGUAGES, sampleText } from './fixtures';

export type MockRecord = {
  id: string;
  accountId: string | null;
  contentType:
    | 'AVATAR'
    | 'VOICE'
    | 'MESSAGE'
    | 'PERSONA'
    | 'COMPANION_NAME'
    | 'AVATAR_IMAGE'
    | 'ACTION_CLIP';
  contentRef: string;
  source: 'AUTO' | 'REPORT' | 'COMPLAINT';
  autoLevel: 'PASS' | 'REVIEW' | 'BLOCK' | null;
  categories: string[] | null;
  score: number | null;
  providerRef: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
  reporterReason: string | null;
  reporterDetail: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
};

export type MediaKind = 'image' | 'audio' | 'video';

/** What the original of a record is: text, a file (with an optional text that belongs to it), or gone. */
export type MockContent =
  | { kind: 'TEXT'; text: string }
  | { kind: 'FILE'; media: MediaKind; text?: string }
  | null;

export type MockRule = {
  id: string;
  pattern: string;
  matchMode: 'SUBSTRING' | 'WORD' | 'REGEX';
  level: 'REVIEW' | 'BLOCK';
  note: string;
};

export type ModerationState = {
  records: MockRecord[];
  contents: Record<string, MockContent>;
  rules: MockRule[];
  /** Signed addresses handed out: signature to the time (ms) it stops working. */
  signatures: Record<string, number>;
  /** One entry per `…/content` call, as the backend's audit log would have it. */
  views: { recordId: string; adminId: string; at: string }[];
  next: { record: number; rule: number; signature: number };
};

/** How long a signed address works in the mock (the real one is `moderation.content_url_ttl_seconds`). */
export const SIGNATURE_TTL_MS = 5 * 60 * 1000;

const RECORD = {
  oldestImage: '5001',
  clip: '5002',
  reportedMessage: '5003',
  reportedAvatar: '5004',
  reportedVoice: '5005',
  persona: '5006',
  companionName: '5007',
  staleCompanionName: '5008',
  blocked: '5009',
  approved: '5010',
  rejected: '5011',
  complaint: '5012',
  longText: '5013',
  autoVoice: '5014',
  autoAvatar: '5015',
} as const;

/** The ids of the sample records the tests look for. */
export const RECORD_ID = RECORD;

/** Chinese, Thai and so on, each with its own rule: an administrator in any market sees their language. */
function seedRules(): MockRule[] {
  const rule = (
    n: number,
    pattern: string,
    matchMode: MockRule['matchMode'],
    level: MockRule['level'],
    note: string,
  ): MockRule => ({
    id: `00000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`,
    pattern,
    matchMode,
    level,
    note,
  });
  return [
    rule(1, 'คำต้องห้าม', 'SUBSTRING', 'REVIEW', 'ภาษาไทย ไม่มีช่องว่างระหว่างคำ'),
    rule(2, 'كلمة محظورة', 'SUBSTRING', 'BLOCK', 'نص عربي من اليمين إلى اليسار'),
    rule(3, 'palabra prohibida', 'WORD', 'REVIEW', 'Español'),
    rule(4, 'kata terlarang', 'WORD', 'BLOCK', 'Bahasa Indonesia'),
    rule(5, 'từ cấm', 'SUBSTRING', 'REVIEW', 'Tiếng Việt'),
    rule(6, 'banned word', 'WORD', 'BLOCK', 'English'),
    rule(7, '违禁词', 'SUBSTRING', 'BLOCK', '中文：没有空格，按子串匹配'),
    rule(8, '\\d{11}\\s?(?:cash|dinero)', 'REGEX', 'REVIEW', ''),
  ];
}

function seed(now: Date): ModerationState {
  const at = (minutesAgo: number): string =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const record = (
    id: string,
    over: Partial<MockRecord> & Pick<MockRecord, 'contentType' | 'source' | 'status' | 'createdAt'>,
  ): MockRecord => ({
    id,
    accountId: '00000000-0000-4000-8000-0000000000a1',
    contentRef: `ref-${id}`,
    autoLevel: over.source === 'AUTO' ? 'REVIEW' : null,
    categories: null,
    score: null,
    providerRef: null,
    reporterReason: null,
    reporterDetail: null,
    reviewedBy: null,
    reviewedAt: null,
    note: null,
    ...over,
  });

  const records: MockRecord[] = [
    record(RECORD.oldestImage, {
      contentType: 'AVATAR_IMAGE',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      autoLevel: 'REVIEW',
      categories: ['sexual_suggestive'],
      score: 0.72,
      providerRef: 'prov-5001',
      createdAt: at(3 * 24 * 60 + 4 * 60),
    }),
    record(RECORD.clip, {
      contentType: 'ACTION_CLIP',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      categories: ['violence'],
      score: 0.64,
      createdAt: at(2 * 24 * 60),
    }),
    record(RECORD.reportedMessage, {
      contentType: 'MESSAGE',
      source: 'REPORT',
      status: 'PENDING_REVIEW',
      reporterReason: 'HARASSMENT',
      reporterDetail: multilingualSamples.th[2],
      createdAt: at(26 * 60),
    }),
    record(RECORD.reportedAvatar, {
      contentType: 'AVATAR',
      source: 'REPORT',
      status: 'PENDING_REVIEW',
      reporterReason: 'SEXUAL',
      reporterDetail: multilingualSamples.ar[2],
      createdAt: at(20 * 60),
    }),
    record(RECORD.reportedVoice, {
      contentType: 'VOICE',
      source: 'REPORT',
      status: 'PENDING_REVIEW',
      reporterReason: 'OTHER',
      reporterDetail: null,
      createdAt: at(15 * 60),
    }),
    record(RECORD.persona, {
      contentType: 'PERSONA',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      categories: ['RULE:00000000-0000-4000-8000-000000000004'],
      createdAt: at(9 * 60),
    }),
    record(RECORD.companionName, {
      contentType: 'COMPANION_NAME',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      score: null,
      createdAt: at(6 * 60),
    }),
    record(RECORD.staleCompanionName, {
      contentType: 'COMPANION_NAME',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      createdAt: at(5 * 60),
    }),
    record(RECORD.blocked, {
      contentType: 'MESSAGE',
      source: 'AUTO',
      status: 'BLOCKED',
      autoLevel: 'BLOCK',
      categories: ['RULE:00000000-0000-4000-8000-000000000002'],
      score: null,
      createdAt: at(4 * 60),
    }),
    record(RECORD.approved, {
      contentType: 'AVATAR',
      source: 'AUTO',
      status: 'APPROVED',
      score: 0.55,
      reviewedBy: '1004',
      reviewedAt: at(3 * 60),
      note: sampleText('vi', 0),
      createdAt: at(8 * 60),
    }),
    record(RECORD.rejected, {
      contentType: 'MESSAGE',
      source: 'REPORT',
      status: 'REJECTED',
      reporterReason: 'VIOLENCE',
      reporterDetail: 'x'.repeat(5000),
      reviewedBy: '9999',
      reviewedAt: at(2 * 60),
      note: sampleText('es', 2),
      createdAt: at(12 * 60),
    }),
    record(RECORD.complaint, {
      contentType: 'AVATAR',
      source: 'COMPLAINT',
      status: 'REJECTED',
      reviewedBy: '1001',
      reviewedAt: at(60),
      note: null,
      createdAt: at(14 * 60),
    }),
    record(RECORD.longText, {
      contentType: 'MESSAGE',
      source: 'REPORT',
      status: 'PENDING_REVIEW',
      reporterReason: 'SELF_HARM',
      reporterDetail: sampleText('id', 2),
      createdAt: at(3 * 60),
    }),
    record(RECORD.autoVoice, {
      contentType: 'VOICE',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      score: 0.58,
      createdAt: at(2 * 60),
    }),
    record(RECORD.autoAvatar, {
      contentType: 'AVATAR',
      source: 'AUTO',
      status: 'PENDING_REVIEW',
      score: 0.61,
      createdAt: at(90),
    }),
  ];

  const contents: Record<string, MockContent> = {
    [RECORD.oldestImage]: { kind: 'FILE', media: 'image' },
    [RECORD.clip]: { kind: 'FILE', media: 'video' },
    [RECORD.reportedMessage]: { kind: 'TEXT', text: multilingualSamples.th[2] },
    [RECORD.reportedAvatar]: { kind: 'FILE', media: 'image' },
    [RECORD.reportedVoice]: { kind: 'FILE', media: 'audio', text: multilingualSamples.vi[2] },
    [RECORD.persona]: { kind: 'TEXT', text: multilingualSamples.id[2] },
    [RECORD.companionName]: { kind: 'TEXT', text: 'María 🌟' },
    [RECORD.staleCompanionName]: null,
    [RECORD.blocked]: null,
    [RECORD.approved]: { kind: 'FILE', media: 'image' },
    [RECORD.rejected]: { kind: 'TEXT', text: multilingualSamples.ar[2] },
    [RECORD.complaint]: null,
    [RECORD.longText]: { kind: 'TEXT', text: 'ก'.repeat(5000) },
    [RECORD.autoVoice]: { kind: 'FILE', media: 'audio' },
    [RECORD.autoAvatar]: { kind: 'FILE', media: 'image' },
  };

  // Filler so that the queue has several pages, in every language of the market.
  const filler: MockRecord['contentType'][] = ['MESSAGE', 'PERSONA', 'COMPANION_NAME', 'MESSAGE'];
  for (let i = 0; i < 30; i += 1) {
    const id = String(5100 + i);
    const language = SAMPLE_LANGUAGES[i % SAMPLE_LANGUAGES.length];
    const contentType = filler[i % filler.length];
    const decided = i % 3 === 0;
    const source: MockRecord['source'] = i % 4 === 0 ? 'REPORT' : 'AUTO';
    records.push(
      record(id, {
        contentType,
        source,
        status: decided ? (i % 2 === 0 ? 'APPROVED' : 'REJECTED') : 'PENDING_REVIEW',
        reporterReason: source === 'REPORT' ? 'OTHER' : null,
        reporterDetail: source === 'REPORT' ? sampleText(language, 1) : null,
        reviewedBy: decided ? '1004' : null,
        reviewedAt: decided ? at(30 + i) : null,
        note: decided ? sampleText(language, 0) : null,
        score: source === 'AUTO' ? 0.5 + (i % 5) / 20 : null,
        createdAt: at(40 + i * 37),
      }),
    );
    contents[id] =
      contentType === 'COMPANION_NAME'
        ? { kind: 'TEXT', text: sampleText(language, 0).slice(0, 12) }
        : { kind: 'TEXT', text: sampleText(language, 2) };
  }

  return {
    records,
    contents,
    rules: seedRules(),
    signatures: {},
    views: [],
    next: { record: 5200, rule: 100, signature: 1 },
  };
}

type Holder = { __avatarAdminMockModeration?: ModerationState };
const holder = globalThis as Holder;
holder.__avatarAdminMockModeration ??= seed(new Date());

/** The state itself: handlers and tests read and change it in place. */
export const moderationState: ModerationState = holder.__avatarAdminMockModeration;

/** Puts the sample data back (in place, so every importer keeps seeing the same object). */
export function resetModerationStore(now: Date = new Date()): void {
  Object.assign(moderationState, seed(now));
}

export const findRecord = (id: string): MockRecord | undefined =>
  moderationState.records.find((record) => record.id === id);

/**
 * What a test does to stand in for a second administrator who saved the rule list after the first
 * one read it: `change` gets a copy of the list and returns the list that is saved (a rule that
 * keeps its `id` stays the same rule). Returns the saved list.
 */
export function simulateOtherRuleListEdit(change: (rules: MockRule[]) => MockRule[]): MockRule[] {
  moderationState.rules = change(moderationState.rules.map((rule) => ({ ...rule })));
  return moderationState.rules;
}

export const nextRuleId = (): string =>
  `00000000-0000-4000-8000-00000001${String(moderationState.next.rule++).padStart(4, '0')}`;

/** Hands out a signed address of the file kind; it works for `SIGNATURE_TTL_MS`. */
export function signAddress(media: MediaKind, now = Date.now()): string {
  const signature = `s${moderationState.next.signature++}x${Math.floor(now / 1000).toString(36)}`;
  moderationState.signatures[signature] = now + SIGNATURE_TTL_MS;
  return `/api/admin/moderation/mock-media/${media}?sig=${signature}`;
}

/** Makes every address handed out so far stop working (a test of the expiry). */
export function expireSignedAddresses(now = Date.now()): void {
  for (const signature of Object.keys(moderationState.signatures)) {
    moderationState.signatures[signature] = now - 1;
  }
}

// ---- the files behind the addresses ----

const IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#2a6f6b"/><circle cx="160" cy="100" r="46" fill="#e8c9a0"/><rect x="100" y="156" width="120" height="70" rx="30" fill="#e8c9a0"/></svg>`;

/** A second of a quiet tone as a WAV file (8 kHz, 8 bit, mono). */
function wavBytes(): Buffer {
  const rate = 8000;
  const samples = rate;
  const data = Buffer.alloc(samples);
  for (let i = 0; i < samples; i += 1)
    data[i] = 128 + Math.round(20 * Math.sin((2 * Math.PI * 440 * i) / rate));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, data]);
}

// A one second, 96 x 96 clip (VP8), so the video player has something to play.
const VIDEO_WEBM =
  'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAJqEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEeTbuMU6uEHFO7a1OsggJU7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECPQAAAAAAAFlSua8GuAQAAAAAAADjXgQFzxYgUBszRYXu5M5yBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAvrwgDgibCBYLqBYJqBAhJUw2f8c3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9ZjwItjxYgUBszRYXu5M2fIoUWjh0VOQ09ERVJEh5RMYXZjNjAuMzEuMTAyIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVAr+eBAKPGgQAAgFAEAJ0BKmAAYAAARwiFhYiFhIgCAgJ1qgIGjL4ReWAe6m91DnF4jF1N7qDA/vtol+1MEkZS//7vN/9vN/9vN/vyAKOXgQDIAPEBAAEQEAAYABhYL/QACIVmAACjl4EBkADxAQABEBAAGAAYWC/0AAiFZgAAo5eBAlgA8QEAARAQABgAGFgv9AAIhWYAAKOXgQMgAPEBAAEQEAAYABhYL/QACIVmAAAcU7trkbuPs4EAt4r3gQHxggGf8IED';

/** The bytes and type of a file kind. */
export function mediaFile(
  media: string,
): { contentType: string; body: Buffer; filename: string } | null {
  if (media === 'image')
    return { contentType: 'image/svg+xml', body: Buffer.from(IMAGE_SVG), filename: 'sample.svg' };
  if (media === 'audio')
    return { contentType: 'audio/wav', body: wavBytes(), filename: 'sample.wav' };
  if (media === 'video')
    return {
      contentType: 'video/webm',
      body: Buffer.from(VIDEO_WEBM, 'base64'),
      filename: 'sample.webm',
    };
  return null;
}

/** The media type the content answer names for a file kind. */
export const MEDIA_TYPE: Record<MediaKind, string> = {
  image: 'image/svg+xml',
  audio: 'audio/wav',
  video: 'video/webm',
};
