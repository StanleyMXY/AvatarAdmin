import { type MissingLocales, type PushTemplate, RECALL_REASONS } from '../../services/push';

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

export type CoverageCell = {
  locale: string;
  template: PushTemplate | null;
  /**
   * True when the backend lists the language as one without an enabled template for the reason (it
   * falls back to the default language), false when it does not; null when it gave no list for the
   * reason. The page does not work this out from the templates: the rule is the backend's.
   */
  fallback: boolean | null;
};
export type CoverageRow = {
  reason: string;
  cells: CoverageCell[];
  /**
   * True when the backend lists every supported language for the reason: it has no enabled template
   * at all. Then no language falls back to anything (the default language is the one that would
   * have to cover the others), so no cell is marked as falling back.
   */
  noneEnabled: boolean;
};

/** A row for each recall reason, a cell for each supported language: the template there (or `null`), and whether the language falls back. */
export function coverage(
  templates: readonly PushTemplate[],
  locales: readonly string[],
  missingLocales: MissingLocales | null,
): CoverageRow[] {
  return RECALL_REASONS.map((reason) => {
    const listed = missingLocales?.[reason];
    const noneEnabled =
      Array.isArray(listed) &&
      locales.length > 0 &&
      locales.every((locale) => listed.includes(locale));
    return {
      reason,
      noneEnabled,
      cells: locales.map((locale) => ({
        locale,
        template: templates.find((t) => t.triggerReason === reason && t.locale === locale) ?? null,
        fallback: Array.isArray(listed) ? !noneEnabled && listed.includes(locale) : null,
      })),
    };
  });
}
