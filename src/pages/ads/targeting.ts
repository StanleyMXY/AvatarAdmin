import type { DayPart, Targeting } from '../../services/ads';
import type { Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';

// The targeting of a unit (contract 22.5): snake_case keys in the request, all optional, an empty
// one meaning "no limit". The form holds the same things as text and lists so that it can be edited,
// and `toTargeting` writes it back without the keys that are empty.

export type TargetingKey =
  | 'platforms'
  | 'geo'
  | 'osVersionMin'
  | 'appVersionMin'
  | 'languages'
  | 'dayParts';

export type TargetingForm = {
  platforms: string[];
  geo: string[];
  osVersionMin: string;
  appVersionMin: string;
  languages: string[];
  dayParts: DayPart[];
};

export const PLATFORMS = ['ANDROID', 'IOS'] as const;

export const emptyTargetingForm = (): TargetingForm => ({
  platforms: [],
  geo: [],
  osVersionMin: '',
  appVersionMin: '',
  languages: [],
  dayParts: [],
});

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];

/** The form for a stored targeting. Whatever has the wrong type is left out instead of breaking the page. */
export function fromTargeting(targeting: Targeting | null | undefined): TargetingForm {
  if (typeof targeting !== 'object' || targeting === null || Array.isArray(targeting)) {
    return emptyTargetingForm();
  }
  const parts = Array.isArray(targeting.day_parts) ? targeting.day_parts : [];
  return {
    platforms: texts(targeting.platforms),
    geo: texts(targeting.geo),
    osVersionMin: typeof targeting.os_version_min === 'string' ? targeting.os_version_min : '',
    appVersionMin: typeof targeting.app_version_min === 'string' ? targeting.app_version_min : '',
    languages: texts(targeting.languages),
    dayParts: parts
      .filter((part): part is DayPart => typeof part === 'object' && part !== null)
      .map((part) => ({
        start: typeof part.start === 'string' ? part.start : '',
        end: typeof part.end === 'string' ? part.end : '',
      })),
  };
}

const VERSION = /^\d+(\.\d+)*$/;
const COUNTRY = /^[A-Z]{2}$/;
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;

const emptyRow = (part: DayPart) => part.start === '' && part.end === '';
const completeRow = (part: DayPart) => CLOCK.test(part.start) && CLOCK.test(part.end);

/**
 * The faults of the form by the rules of 22.5, one reason (`country`, `version`, `language`,
 * `dayPart`) for each field that has one. A row of the time list with nothing in it is not a fault:
 * it is not sent.
 */
export function validateTargeting(form: TargetingForm): Partial<Record<TargetingKey, string>> {
  const faults: Partial<Record<TargetingKey, string>> = {};
  if (!form.geo.every((code) => COUNTRY.test(code))) faults.geo = 'country';
  if (form.osVersionMin !== '' && !VERSION.test(trimSpec(form.osVersionMin))) {
    faults.osVersionMin = 'version';
  }
  if (form.appVersionMin !== '' && !VERSION.test(trimSpec(form.appVersionMin))) {
    faults.appVersionMin = 'version';
  }
  if (!form.languages.every((tag) => LANGUAGE_TAG.test(tag) && tag.length <= 35)) {
    faults.languages = 'language';
  }
  if (!form.dayParts.every((part) => emptyRow(part) || completeRow(part)))
    faults.dayParts = 'dayPart';
  return faults;
}

const KEY_OF: Record<TargetingKey, keyof Targeting> = {
  platforms: 'platforms',
  geo: 'geo',
  osVersionMin: 'os_version_min',
  appVersionMin: 'app_version_min',
  languages: 'languages',
  dayParts: 'day_parts',
};

/**
 * The targeting to send. A key that is empty is left out. `before` is the targeting the unit has
 * now: the update is a JSON Merge Patch, in which a key that is not sent stays, so a key that the
 * unit had and the form emptied is sent as `null` (and no other key is).
 */
export function toTargeting(form: TargetingForm, before?: Targeting | null): Targeting {
  const out: Record<string, unknown> = {};
  if (form.platforms.length > 0) out.platforms = form.platforms;
  if (form.geo.length > 0) out.geo = form.geo;
  if (trimSpec(form.osVersionMin) !== '') out.os_version_min = trimSpec(form.osVersionMin);
  if (trimSpec(form.appVersionMin) !== '') out.app_version_min = trimSpec(form.appVersionMin);
  if (form.languages.length > 0) out.languages = form.languages;
  const parts = form.dayParts
    .filter(completeRow)
    .map((part) => ({ start: part.start, end: part.end }));
  if (parts.length > 0) out.day_parts = parts;
  if (typeof before === 'object' && before !== null) {
    for (const key of Object.values(KEY_OF)) {
      if (key in before && before[key] !== null && !(key in out)) out[key] = null;
    }
  }
  return out as Targeting;
}

const minutes = (clock: string): number | null => {
  if (!CLOCK.test(clock)) return null;
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

/** A start later than the end means "across midnight" (both ends are included). */
export function isOvernight(part: DayPart): boolean {
  const start = minutes(part.start);
  const end = minutes(part.end);
  return start !== null && end !== null && start > end;
}

/** The targeting as one line for a table cell, in the interface language; "no limit" when it sets nothing. */
export function summarizeTargeting(
  intl: Translator,
  targeting: Targeting | null | undefined,
): string {
  const form = fromTargeting(targeting);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const pieces: string[] = [];
  if (form.platforms.length > 0) {
    const names = form.platforms.map((p) =>
      intl.messages[`stat.common.platform.${p}`] ? t(`stat.common.platform.${p}`) : p,
    );
    pieces.push(t('ads.targeting.summary.platforms', { value: names.join(', ') }));
  }
  if (form.geo.length > 0)
    pieces.push(t('ads.targeting.summary.geo', { value: form.geo.join(', ') }));
  if (form.osVersionMin !== '') {
    pieces.push(t('ads.targeting.summary.osVersionMin', { value: plainText(form.osVersionMin) }));
  }
  if (form.appVersionMin !== '') {
    pieces.push(t('ads.targeting.summary.appVersionMin', { value: plainText(form.appVersionMin) }));
  }
  if (form.languages.length > 0) {
    pieces.push(t('ads.targeting.summary.languages', { value: form.languages.join(', ') }));
  }
  const parts = form.dayParts.filter(completeRow);
  if (parts.length > 0) {
    pieces.push(
      t('ads.targeting.summary.dayParts', {
        value: parts.map((part) => `${part.start}–${part.end}`).join(', '),
      }),
    );
  }
  return pieces.length === 0 ? t('ads.targeting.summary.none') : pieces.join('; ');
}
