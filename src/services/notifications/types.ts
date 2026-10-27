import type { LinkType } from '../../components/LinkTargetField';

export type { Page } from '../../request/errors';

/** `ADMIN` is sent by an operator; `SYSTEM_EVENT` is made by a business flow (contract 25.2). */
export const NOTIFICATION_CATEGORIES = ['ADMIN', 'SYSTEM_EVENT'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * A row of `GET /notifications` (backend reply 2, item 16). `title` is the English title: the
 * `en` entry of `titleI18n` for `ADMIN`, the rendered English text for `SYSTEM_EVENT`. The fields
 * are typed as the contract says; the page still shows each as text that is safe whatever arrives.
 */
export type NotificationRow = {
  id: string;
  accountId: string;
  category: NotificationCategory | string;
  title: string;
  isRead: boolean;
  linkType: LinkType | string;
  linkTarget: string | null;
  sentBy: string | null;
  sentByUsername: string | null;
  createdAt: string;
};

/**
 * `GET /notifications/{id}`: every column of `Notification` plus `sentByUsername`. `titleI18n` and
 * `bodyI18n` are `null` for `SYSTEM_EVENT`, `templateKey` and `templateParams` are `null` for `ADMIN`.
 */
export type NotificationDetail = {
  id: string;
  accountId: string;
  category: NotificationCategory | string;
  titleI18n: Record<string, string> | null;
  bodyI18n: Record<string, string> | null;
  templateKey: string | null;
  templateParams: Record<string, unknown> | null;
  linkType: LinkType | string;
  linkTarget: string | null;
  isRead: boolean;
  sentBy: string | null;
  sentByUsername: string | null;
  createdAt: string;
};

export type NotificationQuery = {
  page: number;
  pageSize: number;
  accountId?: string;
  category?: NotificationCategory;
  isRead?: boolean;
  /** Instants (the start of the first UTC day, the start of the day after the last). */
  from?: string;
  to?: string;
};

/** `POST /notifications/send` (contract 25.3). Without a link both link fields are left out. */
export type SendNotificationBody = {
  accountIds: string[];
  titleI18n: Record<string, string>;
  bodyI18n: Record<string, string>;
  linkType?: LinkType;
  linkTarget?: string;
  push: boolean;
};

export type SendNotificationResult = { created: number };
