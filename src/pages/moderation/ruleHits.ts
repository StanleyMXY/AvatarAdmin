import type { ModerationRecord, RuleHit } from '../../services/moderation';

const RULE_PREFIX = 'RULE:';

/** The rules that matched, as the backend sent them (a record from before the field has none). */
export const hitsOf = (record: Pick<ModerationRecord, 'ruleHits'>): RuleHit[] =>
  Array.isArray(record.ruleHits) ? record.ruleHits : [];

/** The categories that are not a word rule: the service's own, shown as they are. */
export const plainCategories = (record: Pick<ModerationRecord, 'categories'>): string[] =>
  (record.categories ?? []).filter((category) => !category.startsWith(RULE_PREFIX));

/** True when the record names a word rule (`RULE:<id>`) that has no hit to show what it matched. */
export const hasRuleWithoutHit = (
  record: Pick<ModerationRecord, 'categories' | 'ruleHits'>,
): boolean => {
  const hitIds = new Set(hitsOf(record).map((hit) => hit.ruleId));
  return (record.categories ?? []).some(
    (category) =>
      category.startsWith(RULE_PREFIX) && !hitIds.has(category.slice(RULE_PREFIX.length)),
  );
};

/**
 * What the queue shows for the categories of a record: the service's categories, then each rule by
 * what it matches and its note. The id of a rule is never shown; a rule with no hit to describe it
 * is told as `unknownRule`.
 */
export function categoryTexts(
  record: Pick<ModerationRecord, 'categories' | 'ruleHits'>,
  unknownRule: string,
): string[] {
  return [
    ...plainCategories(record),
    ...hitsOf(record).map((hit) => (hit.note ? `${hit.pattern} (${hit.note})` : hit.pattern)),
    ...(hasRuleWithoutHit(record) ? [unknownRule] : []),
  ];
}
