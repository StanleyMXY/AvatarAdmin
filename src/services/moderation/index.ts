import { apiRequest } from '../../request/apiClient';
import { trimSpec } from '../../utils/trimSpec';
import type {
  ModerationContent,
  ModerationDecisionBody,
  ModerationQuery,
  ModerationRecord,
  ModerationStats,
  Page,
  TextRule,
  TextRuleInput,
} from './types';

export * from './types';

const enc = encodeURIComponent;

/** `GET /moderation/records`: the review queue, oldest waiting first (the backend orders it). */
export const listModerationRecords = (params: ModerationQuery): Promise<Page<ModerationRecord>> =>
  apiRequest({ method: 'GET', url: '/moderation/records', params });

export const getModerationRecord = (id: string): Promise<ModerationRecord> =>
  apiRequest({ method: 'GET', url: `/moderation/records/${enc(id)}` });

/**
 * `GET /moderation/records/{id}/content` (`MODERATION:REVIEW`): the reviewed text, or a short-lived
 * signed address of the file. Every call is a new request and writes an audit entry on the backend:
 * the answer is never kept, and the address is never logged. A record without a stored original
 * (blocked automatically, or a companion name changed since) answers 404 `CONTENT_NOT_STORED`.
 */
export const getModerationContent = (id: string): Promise<ModerationContent> =>
  apiRequest({ method: 'GET', url: `/moderation/records/${enc(id)}/content` });

/** `POST /moderation/records/{id}/decision` (`MODERATION:REVIEW`). The note is sent trimmed, and left out when empty. */
export const decideModeration = async (id: string, body: ModerationDecisionBody): Promise<void> => {
  const note = trimSpec(body.note ?? '');
  await apiRequest({
    method: 'POST',
    url: `/moderation/records/${enc(id)}/decision`,
    body: { decision: body.decision, ...(note ? { note } : {}) },
  });
};

/** `GET /moderation/stats` (`MODERATION:VIEW`); `from` and `to` are UTC calendar days `YYYY-MM-DD`, both included. */
export const getModerationStats = (range: { from: string; to: string }): Promise<ModerationStats> =>
  apiRequest({
    method: 'GET',
    url: '/moderation/stats',
    params: { from: range.from, to: range.to },
  });

/** `GET /moderation/text-rules` (`MODERATION:CONFIG`), in the saved order. */
export const getTextRules = (): Promise<{ items: TextRule[] }> =>
  apiRequest({ method: 'GET', url: '/moderation/text-rules' });

/**
 * `PUT /moderation/text-rules` (`MODERATION:CONFIG`): replaces the whole list, all or nothing. An
 * element with the `id` of a current rule keeps it, one without is new, a current rule that is not
 * sent is deleted. A refusal names the elements by their index in `items`.
 */
export const saveTextRules = (items: TextRuleInput[]): Promise<{ items: TextRule[] }> =>
  apiRequest({ method: 'PUT', url: '/moderation/text-rules', body: { items } });
