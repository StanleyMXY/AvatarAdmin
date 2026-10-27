// State of the support mock: feedback the app has sent, in every forwarding state, in the
// languages of the target markets. `resetSupportStore` puts the sample data back.
import {
  daysAgoIso,
  multilingualSamples,
  SAMPLE_LANGUAGES,
  sampleAny,
  sampleText,
} from './fixtures';

export type FeedbackRow = {
  id: string;
  accountId: string;
  category: 'BUG' | 'QUESTION' | 'SUGGESTION' | 'OTHER';
  message: string;
  context: {
    appVersion: string;
    osVersion: string;
    deviceModel: string;
    locale: string;
    recentErrors: string[];
  } | null;
  forwardStatus: 'PENDING' | 'FORWARDED' | 'FAILED';
  forwardRef: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type SupportStore = { rows: FeedbackRow[] };

const holder = globalThis as { __avatarAdminMockSupport?: SupportStore };
holder.__avatarAdminMockSupport ??= { rows: [] };

export const supportStore: SupportStore = holder.__avatarAdminMockSupport;

const CATEGORIES = ['BUG', 'QUESTION', 'SUGGESTION', 'OTHER'] as const;
const STATUSES = ['FORWARDED', 'FORWARDED', 'PENDING', 'FAILED', 'FORWARDED', 'FAILED'] as const;
const LOCALES = ['th-TH', 'ar-SA', 'id-ID', 'vi-VN', 'es-MX', 'en-US', 'zh-Hans-SG'];
const DEVICES = ['Pixel 8', 'SM-S918B', 'Redmi Note 12'];

export function resetSupportStore(): void {
  supportStore.rows = Array.from({ length: 36 }, (_, i): FeedbackRow => {
    const forwardStatus = STATUSES[i % STATUSES.length];
    const language = SAMPLE_LANGUAGES[i % SAMPLE_LANGUAGES.length];
    let message = sampleAny(i);
    // a Thai text of 4000 code points without a space, and a long Arabic text with spaces
    if (i === 8) message = 'ก็'.repeat(2000);
    if (i === 13) message = `${multilingualSamples.ar[2]} `.repeat(40).trim();
    return {
      id: String(5000 + i),
      accountId: String(2000 + (i % 9)),
      category: CATEGORIES[i % CATEGORIES.length],
      message,
      context:
        i === 5
          ? null
          : {
              appVersion: `1.0.${i % 5}`,
              osVersion: String(12 + (i % 4)),
              deviceModel: DEVICES[i % DEVICES.length],
              locale: LOCALES[SAMPLE_LANGUAGES.indexOf(language)],
              recentErrors: [
                'java.net.SocketTimeoutException: timeout',
                sampleText(language, 1),
                `E/Call ${'0123456789'.repeat(30)}`,
              ].slice(0, 1 + (i % 3)),
            },
      forwardStatus,
      forwardRef: forwardStatus === 'FORWARDED' ? `TICKET-${7000 + i}` : null,
      attempts: forwardStatus === 'FAILED' ? 10 : forwardStatus === 'PENDING' ? 2 : 0,
      nextAttemptAt:
        forwardStatus === 'PENDING' ? new Date(Date.now() + 600_000).toISOString() : null,
      lastError:
        forwardStatus === 'FORWARDED' ? null : 'The support tool answered 503 Service Unavailable',
      createdAt: daysAgoIso(i * 0.4),
    };
  });
}

resetSupportStore();
