import { type PushTemplate, RECALL_REASONS } from '../../services/push';

/**
 * The languages of `GET /meta` (`app.supported_locales`) as a list of tags, once each; `null` when
 * the field is missing, empty or not a list of non-empty texts. Without it the matrix is not drawn
 * and nothing is checked in the browser: the backend decides.
 */
export function supportedLocalesOf(meta: { supportedLocales?: unknown }): string[] | null {
  const value = meta.supportedLocales;
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.some((tag) => typeof tag !== 'string' || tag === '')) return null;
  return [...new Set(value as string[])];
}

export type CoverageCell = { locale: string; template: PushTemplate | null };
export type CoverageRow = { reason: string; cells: CoverageCell[] };

/** A row for each recall reason, a cell for each supported language: the template there, or `null` (missing). */
export function coverage(
  templates: readonly PushTemplate[],
  locales: readonly string[],
): CoverageRow[] {
  return RECALL_REASONS.map((reason) => ({
    reason,
    cells: locales.map((locale) => ({
      locale,
      template: templates.find((t) => t.triggerReason === reason && t.locale === locale) ?? null,
    })),
  }));
}

/**
 * The supported languages in which the reason has no template (contract 8.4: a recall reason may be
 * on only when none is missing). `adding` is the language of a template that is about to be made.
 */
export function missingFor(
  templates: readonly PushTemplate[],
  locales: readonly string[] | null,
  reason: string,
  adding?: string,
): string[] {
  if (locales === null) return [];
  return locales.filter(
    (locale) =>
      locale !== adding &&
      !templates.some((t) => t.triggerReason === reason && t.locale === locale),
  );
}
