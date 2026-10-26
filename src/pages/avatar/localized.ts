import { trimSpec } from '../../utils/trimSpec';

export type Texts = Record<string, string>;

/** The tags a texts field offers: English first, then the languages the deployment supports, then any tag the value already has. */
export function languageTags(
  supported: readonly string[] | null | undefined,
  value: Texts | undefined,
): string[] {
  return [...new Set(['en', ...(supported ?? []), ...Object.keys(value ?? {})])];
}

/** The texts to send: trimmed with the contract's set, and the languages left empty are left out. */
export function cleanTexts(value: Texts | undefined): Texts {
  const result: Texts = {};
  for (const [tag, text] of Object.entries(value ?? {})) {
    const trimmed = trimSpec(text ?? '');
    if (trimmed !== '') result[tag] = trimmed;
  }
  return result;
}

/** The language tags to try for an interface language, most specific first. */
function candidates(locale: string): string[] {
  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) return ['zh-Hans', 'zh-CN', 'zh'];
  const base = lower.split(/[-_]/)[0];
  return [locale, base];
}

/**
 * The text to show for a list column: the interface language, then English, then whatever language
 * the item has (the first by tag). `null` when there is no text at all.
 */
export function pickText(texts: Texts | null | undefined, locale: string): string | null {
  if (!texts) return null;
  const has = (tag: string) => Object.hasOwn(texts, tag) && texts[tag] !== '';
  for (const tag of [...candidates(locale), 'en']) if (has(tag)) return texts[tag];
  const any = Object.keys(texts).sort().find(has);
  return any === undefined ? null : texts[any];
}

/** The name of a language in the interface language, or the tag itself when the browser does not know it. */
export function languageName(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
