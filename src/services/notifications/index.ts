import { apiRequest } from '../../request/apiClient';
import type {
  NotificationDetail,
  NotificationQuery,
  NotificationRow,
  Page,
  SendNotificationBody,
  SendNotificationResult,
} from './types';

export * from './types';

/** `GET /notifications` (NOTIFICATION:VIEW), newest first. Only the filters that are given are sent. */
export function listNotifications(query: NotificationQuery): Promise<Page<NotificationRow>> {
  const params: Record<string, string | number | boolean> = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.accountId) params.accountId = query.accountId;
  if (query.category) params.category = query.category;
  if (query.isRead !== undefined) params.isRead = query.isRead;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  return apiRequest<Page<NotificationRow>>({ method: 'GET', url: '/notifications', params });
}

/** `GET /notifications/{id}` (NOTIFICATION:VIEW): every language of the title and body, the template key and parameters. */
export const getNotification = (id: string): Promise<NotificationDetail> =>
  apiRequest<NotificationDetail>({
    method: 'GET',
    url: `/notifications/${encodeURIComponent(id)}`,
  });

/**
 * `POST /notifications/send` (NOTIFICATION:SEND). One bad recipient refuses the whole batch:
 * 400 INVALID_REQUEST with `details` naming each bad account, and nothing is written.
 */
export const sendNotifications = (body: SendNotificationBody): Promise<SendNotificationResult> =>
  apiRequest<SendNotificationResult>({ method: 'POST', url: '/notifications/send', body });
