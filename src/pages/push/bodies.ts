import type { Dayjs } from 'dayjs';
import type { LinkTargetValue } from '../../components/LinkTargetField';
import type {
  Audience,
  AudienceFields,
  ContentFields,
  PushPlatform,
  PushSchedule,
  Repeat,
  ScheduleFields,
} from '../../services/push';
import { trimSpec } from '../../utils/trimSpec';

/** The ids in the box: one on a line, or split by spaces or commas (also the wide ones), once each. */
export function parseAccountIds(text: string): string[] {
  const ids = text
    .split(/[\s,;，；]+/u)
    .map(trimSpec)
    .filter((id) => id !== '');
  return [...new Set(ids)];
}

export type ContentValues = { title: string; body: string; link: LinkTargetValue };

/** The words and the link of a push as the request wants them; the picture is its upload id, never an address. */
export function contentFields(values: ContentValues, uploadId?: string): ContentFields {
  const linkType = values.link.linkType;
  return {
    title: trimSpec(values.title),
    body: trimSpec(values.body),
    linkType,
    linkTarget: linkType === 'NONE' ? '' : values.link.linkTarget,
    ...(uploadId ? { uploadId } : {}),
  };
}

export type AudienceValues = {
  audience: Audience;
  accountIdsText: string;
  platforms: PushPlatform[];
  locales: string[];
};

/**
 * The audience of a request. With an account list the platforms and languages are not sent at all
 * (the backend refuses them there); with another audience the account list is not sent.
 */
export function audienceFields(values: AudienceValues): AudienceFields {
  if (values.audience === 'ACCOUNT_IDS') {
    return { audience: 'ACCOUNT_IDS', accountIds: parseAccountIds(values.accountIdsText) };
  }
  return {
    audience: values.audience,
    ...(values.platforms.length > 0 ? { platforms: values.platforms } : {}),
    ...(values.locales.length > 0 ? { locales: values.locales } : {}),
  };
}

/** The clock fields the picker shows, read as UTC: the person is choosing a UTC time. */
export function pickedInstantUtc(picked: Dayjs): string {
  return new Date(
    Date.UTC(picked.year(), picked.month(), picked.date(), picked.hour(), picked.minute()),
  ).toISOString();
}

export type ScheduleValues = ContentValues &
  AudienceValues & {
    repeat: Repeat;
    daysOfWeek: number[];
    dayOfMonth: number | null;
    timeOfDay: string;
    timezone: string;
    startDate: string;
    endDate: string | null;
    enabled: boolean;
  };

/** The request body of a periodic push: only the day field of the chosen repeat is sent. */
export function scheduleFields(values: ScheduleValues, uploadId?: string): ScheduleFields {
  return {
    repeat: values.repeat,
    ...(values.repeat === 'WEEKLY'
      ? { daysOfWeek: [...new Set(values.daysOfWeek)].sort((a, b) => a - b) }
      : {}),
    ...(values.repeat === 'MONTHLY' && values.dayOfMonth !== null
      ? { dayOfMonth: values.dayOfMonth }
      : {}),
    timeOfDay: values.timeOfDay,
    timezone: values.timezone,
    startDate: values.startDate,
    endDate: values.endDate,
    enabled: values.enabled,
    ...audienceFields(values),
    ...contentFields(values, uploadId),
  };
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** A row of the list as the values of the form again (for the dialog, and for the switch in the list). */
export function scheduleToValues(row: PushSchedule): ScheduleValues {
  return {
    repeat: row.repeat,
    daysOfWeek: listOf<number>(row.daysOfWeek),
    dayOfMonth: typeof row.dayOfMonth === 'number' ? row.dayOfMonth : null,
    timeOfDay: textOf(row.timeOfDay),
    timezone: textOf(row.timezone),
    startDate: textOf(row.startDate),
    endDate: typeof row.endDate === 'string' ? row.endDate : null,
    enabled: row.enabled === true,
    audience: row.audience,
    accountIdsText: listOf<string>(row.accountIds).join('\n'),
    platforms: listOf<PushPlatform>(row.platforms),
    locales: listOf<string>(row.locales),
    title: textOf(row.title),
    body: textOf(row.body),
    link: { linkType: row.linkType, linkTarget: textOf(row.linkTarget) },
  };
}

const FALLBACK_ZONES = [
  'Africa/Cairo',
  'Africa/Lagos',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Riyadh',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Madrid',
];

/**
 * The IANA names for the time zone list: UTC first (the default), a zone the form already holds
 * next (a saved one that this browser does not know), then the browser's own list.
 */
export function timeZoneNames(current?: string): string[] {
  let known: string[];
  try {
    known =
      (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
        'timeZone',
      ) ?? FALLBACK_ZONES;
  } catch {
    known = FALLBACK_ZONES;
  }
  const head = ['UTC', ...(current && current !== 'UTC' ? [current] : [])];
  return [...new Set([...head, ...known])];
}
