import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';

export type FeedbackCategory = 'BUG' | 'QUESTION' | 'SUGGESTION' | 'OTHER';
export type ForwardStatus = 'PENDING' | 'FORWARDED' | 'FAILED';

/** What the app sent along with the feedback (contract 12); any of it can be missing. */
export type FeedbackContext = {
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  locale?: string;
  recentErrors?: string[];
};

export type SupportFeedback = {
  id: string;
  accountId: string;
  category: FeedbackCategory | string;
  message: string;
  context: FeedbackContext | null;
  forwardStatus: ForwardStatus | string;
  forwardRef: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
};

/** `GET /support/feedback` (`SUPPORT:VIEW`), newest first. */
export const listFeedback = (query: {
  page: number;
  pageSize: number;
}): Promise<Page<SupportFeedback>> =>
  apiRequest<Page<SupportFeedback>>({ method: 'GET', url: '/support/feedback', params: query });

/** `GET /support/feedback/{id}` (`SUPPORT:VIEW`). */
export const getFeedback = (id: string): Promise<SupportFeedback> =>
  apiRequest<SupportFeedback>({
    method: 'GET',
    url: `/support/feedback/${encodeURIComponent(id)}`,
  });

/** `POST /support/feedback/{id}/retry` (`SUPPORT:MANAGE`): forward a FAILED feedback again. */
export const retryFeedback = async (id: string): Promise<void> => {
  await apiRequest<unknown>({
    method: 'POST',
    url: `/support/feedback/${encodeURIComponent(id)}/retry`,
  });
};
