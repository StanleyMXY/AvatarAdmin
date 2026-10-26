// In-memory state of the in-app notification endpoints of the mock backend (contract 25, backend
// reply 2 item 16). Rows hang on `globalThis` like the rest of the mock state (see store.ts).
// Not a mock file itself: Umi's loader reads every file in mock/.
import { daysAgoIso, multilingualSamples, sampleText } from './fixtures';
import { usersState } from './usersData';

export type MockNotification = {
  id: string;
  accountId: string;
  category: 'ADMIN' | 'SYSTEM_EVENT';
  /** Language tag to text; `ADMIN` only. */
  titleI18n: Record<string, string> | null;
  bodyI18n: Record<string, string> | null;
  /** `SYSTEM_EVENT` only. */
  templateKey: string | null;
  templateParams: Record<string, unknown> | null;
  /** The English title the list shows for a system event (the template rendered). */
  renderedTitle: string | null;
  linkType: 'NONE' | 'SCREEN' | 'URL';
  linkTarget: string | null;
  isRead: boolean;
  sentBy: string | null;
  createdAt: string;
};

type NotificationsStore = { rows: MockNotification[]; nextId: number };

const holder = globalThis as { __avatarAdminMockNotifications?: NotificationsStore };
holder.__avatarAdminMockNotifications ??= { rows: [], nextId: 1 };

export const notificationsState: NotificationsStore = holder.__avatarAdminMockNotifications;

export const SYSTEM_TEMPLATES: {
  key: string;
  params: Record<string, unknown>;
  title: string;
  link: [MockNotification['linkType'], string];
}[] = [
  {
    key: 'notification.moderation.rejected',
    params: { contentType: 'AVATAR' },
    title: 'Your avatar did not pass the review',
    link: ['SCREEN', 'companion'],
  },
  {
    key: 'notification.export.ready',
    params: {},
    title: 'Your data export is ready',
    link: ['SCREEN', 'settings'],
  },
  {
    key: 'notification.subscription.billing_issue',
    params: { state: 'IN_GRACE_PERIOD' },
    title: 'There is a problem with your payment',
    link: ['SCREEN', 'subscription'],
  },
  {
    key: 'notification.generation.succeeded',
    params: { contentType: 'VOICE' },
    title: 'Your voice is ready',
    link: ['SCREEN', 'companion'],
  },
  {
    key: 'notification.generation.failed',
    params: { contentType: 'LOOK', failureReason: 'TIMEOUT' },
    title: 'Your look could not be made',
    link: ['SCREEN', 'companion'],
  },
];

const LANGUAGE_TAGS = ['th', 'ar', 'id', 'vi', 'es', 'zh-Hans'] as const;
const SAMPLE_OF = { th: 'th', ar: 'ar', id: 'id', vi: 'vi', es: 'es', 'zh-Hans': 'zh' } as const;

function seedRows(): MockNotification[] {
  const accounts = usersState.users.slice(0, 9).map((user) => user.id);
  const rows: MockNotification[] = [];
  const hoursAgo = (n: number) => daysAgoIso(n / 24);
  for (let i = 0; i < 36; i += 1) {
    const accountId = accounts[i % accounts.length];
    const createdAt = hoursAgo(i * 7 + 1);
    const common = {
      id: `n-${String(i + 1).padStart(4, '0')}`,
      accountId,
      isRead: i % 3 === 0,
      createdAt,
    };
    if (i % 4 === 3) {
      const template = SYSTEM_TEMPLATES[(i >> 2) % SYSTEM_TEMPLATES.length];
      rows.push({
        ...common,
        category: 'SYSTEM_EVENT',
        titleI18n: null,
        bodyI18n: null,
        templateKey: template.key,
        templateParams: template.params,
        renderedTitle: template.title,
        linkType: template.link[0],
        linkTarget: template.link[1],
        sentBy: null,
      });
      continue;
    }
    // Operator messages: English always, then a growing set of the other languages.
    const pick = i + Math.floor(i / 4);
    const titleI18n: Record<string, string> = { en: sampleText('en', pick) };
    const bodyI18n: Record<string, string> = { en: `${sampleText('en', pick + 1)}.` };
    for (const tag of LANGUAGE_TAGS.slice(0, i % 7)) {
      titleI18n[tag] = sampleText(SAMPLE_OF[tag], pick);
      bodyI18n[tag] = sampleText(SAMPLE_OF[tag], pick + 1);
    }
    if (i === 4) {
      // A title and a body that are one unbroken string, and one with emoji outside the BMP.
      titleI18n.en = 'A'.repeat(100);
      bodyI18n.en = multilingualSamples.longUnbroken;
      titleI18n.th = 'ก็'.repeat(50);
    }
    const kind = i % 3;
    rows.push({
      ...common,
      category: 'ADMIN',
      titleI18n,
      bodyI18n,
      templateKey: null,
      templateParams: null,
      renderedTitle: null,
      linkType: kind === 0 ? 'NONE' : kind === 1 ? 'SCREEN' : 'URL',
      linkTarget: kind === 0 ? null : kind === 1 ? 'store' : 'https://example.com/news?id=7',
      sentBy: '1001',
    });
  }
  return rows;
}

export function resetNotificationsStore(): void {
  notificationsState.rows = seedRows();
  notificationsState.nextId = notificationsState.rows.length + 1;
}

resetNotificationsStore();
