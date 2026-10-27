import type { ClientConfigItem, ClientConfigValue } from '../../services/clientConfig';

/**
 * Where the value the client gets comes from: the language that was asked for (`LANGUAGE`), the
 * default of the key (`DEFAULT`, a value without a language or the registered default), or nowhere
 * (`UNSET`: the entry is not shown in the app).
 */
export type PreviewSource = 'LANGUAGE' | 'DEFAULT' | 'UNSET';

export type Preview = {
  source: PreviewSource;
  /** The tag of the row the value is from: the language tag, `""` for the default row; null for the registered default and for nothing. */
  matched: string | null;
  value: ClientConfigValue | null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const primary = (tag: string) => tag.split('-')[0];

/** The script of a tag: written in it, else for Chinese by the region (Taiwan, Hong Kong, Macau are traditional). Other languages have none. */
function script(tag: string): 'hans' | 'hant' | null {
  const parts = tag.split('-').slice(1);
  const written = parts.find((part) => part === 'hans' || part === 'hant');
  if (written) return written as 'hans' | 'hant';
  if (primary(tag) !== 'zh') return null;
  const region = parts.find((part) => /^[a-z]{2}$/.test(part) || /^[0-9]{3}$/.test(part));
  return region === 'tw' || region === 'hk' || region === 'mo' ? 'hant' : 'hans';
}

/**
 * The row of the key that the language negotiation of the contract (1.2) picks for one requested
 * language: a full match, else the rows of the same main language, narrowed to those that are a
 * prefix of the request, then to the same script, then the first. Tags are compared in lower case.
 */
function matchLanguage(tags: string[], requested: string): string | null {
  const wanted = requested.toLowerCase();
  const lower = tags.map((tag) => [tag, tag.toLowerCase()] as const);
  const full = lower.find(([, tag]) => tag === wanted);
  if (full) return full[0];
  let candidates = lower.filter(([, tag]) => primary(tag) === primary(wanted));
  if (candidates.length <= 1) return candidates[0]?.[0] ?? null;
  const prefixes = candidates.filter(([, tag]) => wanted.startsWith(`${tag}-`));
  if (prefixes.length > 0) candidates = prefixes;
  if (candidates.length > 1) {
    const wantedScript = script(wanted);
    const sameScript = candidates.filter(([, tag]) => script(tag) === wantedScript);
    if (sameScript.length > 0) candidates = sameScript;
  }
  return [...candidates].sort((a, b) => (a[1] < b[1] ? -1 : 1))[0][0];
}

/**
 * The value the client gets for the language `requested`, and where it comes from (contract 26.1):
 * the row of that language, else the key's value without a language, else the registered default,
 * else nothing. A key that is not localized has no rows of languages. A value of `false`, `0` or
 * an empty text is a value.
 */
export function resolvePreview(
  item: Pick<ClientConfigItem, 'values' | 'localized' | 'defaultValue'>,
  requested: string,
): Preview {
  const values = isPlainObject(item.values) ? item.values : {};
  const wanted = requested.trim();
  if (item.localized && wanted !== '') {
    const tags = Object.keys(values).filter((tag) => tag !== '');
    const tag = matchLanguage(tags, wanted);
    if (tag !== null) {
      return { source: 'LANGUAGE', matched: tag, value: values[tag] as ClientConfigValue };
    }
  }
  if (Object.hasOwn(values, '')) {
    return { source: 'DEFAULT', matched: '', value: values[''] as ClientConfigValue };
  }
  if (item.defaultValue !== null && item.defaultValue !== undefined) {
    return { source: 'DEFAULT', matched: null, value: item.defaultValue };
  }
  return { source: 'UNSET', matched: null, value: null };
}
