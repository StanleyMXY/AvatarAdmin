import type { StatusOption } from '../../components/StatusTag';
import {
  MODERATION_CONTENT_TYPES,
  MODERATION_SOURCES,
  MODERATION_STATUSES,
} from '../../services/moderation';
import { DASH } from '../../utils/ratio';

export type T = (id: string, values?: Record<string, string | number>) => string;
type Messages = Record<string, unknown>;

export const STATUS_COLORS: Record<string, string | undefined> = {
  PENDING_REVIEW: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  BLOCKED: 'volcano',
};

/** The text of `<prefix>.<value>`, or the value itself when the language file has no text for it. */
export function labelOf(t: T, messages: Messages, prefix: string, value: string | null): string {
  if (value === null || value === '') return DASH;
  return messages[`${prefix}.${value}`] ? t(`${prefix}.${value}`) : value;
}

export const statusOptions = (t: T): Record<string, StatusOption> =>
  Object.fromEntries(
    MODERATION_STATUSES.map((s) => [
      s,
      { label: t(`moderation.status.${s}`), color: STATUS_COLORS[s] },
    ]),
  );

const enumOf = (t: T, prefix: string, values: readonly string[]) =>
  Object.fromEntries(values.map((v) => [v, { text: t(`${prefix}.${v}`) }]));

export const statusEnum = (t: T) => enumOf(t, 'moderation.status', MODERATION_STATUSES);
export const sourceEnum = (t: T) => enumOf(t, 'moderation.source', MODERATION_SOURCES);
export const contentTypeEnum = (t: T) =>
  enumOf(t, 'moderation.contentType', MODERATION_CONTENT_TYPES);
