import { validateServerLink } from '../../utils/linkRule';

// The store link of a STORE channel (contract 24.2). The check is the browser's first word; the
// backend decides. It reads the text as it is, character by character: it does not parse the
// link with `URL`, which would quietly turn a backslash into a slash, drop a trailing dot or decode
// a percent sequence and so accept what the app and the backend refuse.

export type StorePlatform = 'ANDROID' | 'IOS';

/** `reasonKey` is the id of a text in both language files; the page shows that text. */
export type StoreUrlCheck = { ok: true } | { ok: false; reasonKey: string };

const key = (name: string) => `appVersions.storeUrl.${name}`;
const bad = (reasonKey: string): StoreUrlCheck => ({ ok: false, reasonKey });

const SCHEME = 'https://';
const PLAY_HOST = 'play.google.com';
const PLAY_PATH = '/store/apps/details';
const APPLE_HOST = 'apps.apple.com';
const ALLOWED_PARAMS = ['id', 'hl', 'gl'];
// `hl` and `gl` (contract 24.2): a language or a region, such as `en`, `pt-BR`, `zh_Hans`, `es-419`.
const LANGUAGE_VALUE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/;
// What an application id looks like, used only when the channel has no package name to compare with.
const APPLICATION_ID = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
// `/<country>/app/<name>/id<digits>` or `/app/id<digits>`.
const IOS_PATH = /^(?:\/[A-Za-z]{2}\/app\/[^/]+\/id[0-9]+|\/app\/id[0-9]+)$/;

/** The host (with a port, if there is one) and what follows it. */
function split(url: string): { authority: string; rest: string } {
  const afterScheme = url.slice(SCHEME.length);
  const end = afterScheme.search(/[/?#]/);
  return end === -1
    ? { authority: afterScheme, rest: '' }
    : { authority: afterScheme.slice(0, end), rest: afterScheme.slice(end) };
}

function checkAndroidQuery(query: string, packageName: string): StoreUrlCheck {
  const seen = new Set<string>();
  for (const part of query.split('&')) {
    const equals = part.indexOf('=');
    const name = equals === -1 ? part : part.slice(0, equals);
    const value = equals === -1 ? '' : part.slice(equals + 1);
    if (!ALLOWED_PARAMS.includes(name)) return bad(key('queryKey'));
    if (seen.has(name)) return bad(key('duplicateParam'));
    seen.add(name);
    if (name === 'id') {
      if (packageName !== '' ? value !== packageName : !APPLICATION_ID.test(value)) {
        return bad(key(packageName !== '' ? 'idMismatch' : 'idInvalid'));
      }
    } else if (!LANGUAGE_VALUE.test(value)) {
      return bad(key('langParam'));
    }
  }
  return seen.has('id') ? { ok: true } : bad(key('idMissing'));
}

/**
 * Checks the store link of a version of a STORE channel. ANDROID: https, the host play.google.com, the path
 * /store/apps/details and the parameter `id` with the package name (contract 24.2) and, at most once each, `hl` and `gl`; no other parameter, no port, no user information, no
 * fragment; the host in any case, the path exactly. IOS: host `apps.apple.com`, the path in one of
 * the two shapes of the contract. The link also has to pass the one rule of contract 1.7
 * (`validateServerLink`), and that rule is applied first. `packageName` is the package of the
 * channel; when it is not known, the `id` only has to look like an application id.
 */
export function validateStoreUrl(
  platform: StorePlatform,
  url: string,
  packageName?: string,
): StoreUrlCheck {
  if (platform !== 'ANDROID' && platform !== 'IOS') return bad(key('platform'));
  if (url === '') return bad(key('empty'));
  const link = validateServerLink(url);
  if (!link.ok) return bad(`reason.${link.reasonKey}`);

  const { authority, rest } = split(url);
  const host = authority.toLowerCase();
  if (platform === 'IOS') {
    if (host !== APPLE_HOST) return bad(key('iosHost'));
    const path = rest.split(/[?#]/, 1)[0];
    return IOS_PATH.test(path) ? { ok: true } : bad(key('iosPath'));
  }

  if (authority.includes(':')) return bad(key('port'));
  if (host !== PLAY_HOST) return bad(key('androidHost'));
  if (rest.includes('#')) return bad(key('fragment'));
  const question = rest.indexOf('?');
  const path = question === -1 ? rest : rest.slice(0, question);
  if (path !== PLAY_PATH) return bad(key('androidPath'));
  if (question === -1) return bad(key('idMissing'));
  return checkAndroidQuery(rest.slice(question + 1), packageName ?? '');
}
