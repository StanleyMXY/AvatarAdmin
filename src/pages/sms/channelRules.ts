import type { ChannelInput, ChannelPatch, SmsType } from '../../services/sms';
import { trimSpec } from '../../utils/trimSpec';

export type ApiUrlProblem = 'NOT_AN_URL' | 'NOT_HTTPS' | 'HAS_USER_INFO' | 'HOST_NOT_ALLOWED';

/**
 * What is wrong with the address of a channel, or null. The address must be https and its host must
 * be one that the provider lists (`GET /sms/meta`); with no list given the host is left to the
 * backend. Hosts are compared in lower case, without the port.
 */
export function apiUrlProblem(
  raw: string,
  allowedHosts: string[] | undefined,
): ApiUrlProblem | null {
  let url: URL;
  try {
    url = new URL(trimSpec(raw));
  } catch {
    return 'NOT_AN_URL';
  }
  if (url.protocol !== 'https:') return 'NOT_HTTPS';
  if (url.username !== '' || url.password !== '') return 'HAS_USER_INFO';
  if (!allowedHosts || allowedHosts.length === 0) return null;
  const host = url.hostname.toLowerCase();
  return allowedHosts.some((allowed) => allowed.toLowerCase() === host) ? null : 'HOST_NOT_ALLOWED';
}

/** A country code is two letters (ISO 3166-1 alpha-2), in either case. */
export function countryCodeProblem(code: string): 'INVALID' | null {
  return /^[A-Za-z]{2}$/.test(code) ? null : 'INVALID';
}

/** The country codes cut at the ends, in capitals, without repeats, in the order given. */
export function normalizeCountries(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const code = trimSpec(entry).toUpperCase();
    if (code !== '') seen.add(code);
  }
  return [...seen];
}

const filled = (text: string | undefined): boolean => trimSpec(text ?? '') !== '';

/** The credentials as the form holds them: the text typed for each name the provider declares. */
export type CredentialValues = Record<string, string | undefined>;

export type CredentialsProblem = { kind: 'INCOMPLETE' | 'REQUIRED'; missing: string[] } | null;

/**
 * What is wrong with the credential fields of a provider that declares `names` (its
 * `credentialNames` in `GET /sms/meta`). Credentials are sent whole or not at all: the backend wants
 * exactly the declared names, so a field filled while another is blank is `INCOMPLETE`. All blank
 * is fine, it keeps what is saved, unless `required` (a new provider cannot use what was saved for
 * the old one; then it is `REQUIRED`). A provider that declares none has no fields and no problem.
 */
export function credentialsProblem(
  values: CredentialValues | undefined,
  names: readonly string[],
  required: boolean,
): CredentialsProblem {
  if (names.length === 0) return null;
  const missing = names.filter((name) => !filled(values?.[name]));
  if (missing.length === 0) return null;
  if (missing.length === names.length) return required ? { kind: 'REQUIRED', missing } : null;
  return { kind: 'INCOMPLETE', missing };
}

export type ChannelFormValues = {
  channelCode?: string;
  name: string;
  providerCode: string;
  apiUrl: string;
  credentials?: CredentialValues;
  extConfig?: string;
  countries?: string[];
  smsType: SmsType;
  priority: number;
  enabled?: boolean;
};

/** The JSON of the extension box as an object; an empty box is null. Throws on text that is not JSON (the form refuses it first). */
export function extConfigOf(text: string | undefined): Record<string, unknown> | null {
  const trimmed = trimSpec(text ?? '');
  return trimmed === '' ? null : (JSON.parse(trimmed) as Record<string, unknown>);
}

export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'create',
  credentialNames?: readonly string[],
): ChannelInput;
export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'update',
  credentialNames?: readonly string[],
): ChannelPatch;
export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'create' | 'update',
  credentialNames?: readonly string[],
): ChannelInput | ChannelPatch;
/**
 * The body of a create or an update. The credentials are in it only when every name the provider
 * declares (`credentialNames`) was filled: then they are exactly those names, as text, and replace
 * everything stored; nothing typed, a name left blank (the form refuses that first) or a provider
 * that declares none leaves the key out, so that the backend keeps what it holds (the page has no
 * way to clear them: `{}` and null mean "unchanged" too). No field of an update is null: null would
 * keep the stored value. An update has neither the code nor the switch: the code cannot change, and
 * the switch has its own request.
 */
export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'create' | 'update',
  credentialNames: readonly string[] = [],
): ChannelInput | ChannelPatch {
  const whole =
    credentialNames.length > 0 &&
    credentialNames.every((name) => filled(values.credentials?.[name]));
  const credentials = whole
    ? Object.fromEntries(
        credentialNames.map((name) => [name, trimSpec(values.credentials?.[name] as string)]),
      )
    : {};
  const common = {
    name: trimSpec(values.name),
    providerCode: values.providerCode,
    apiUrl: trimSpec(values.apiUrl),
    countries: normalizeCountries(values.countries),
    smsType: values.smsType,
    priority: values.priority,
    ...(Object.keys(credentials).length === 0 ? {} : { credentials }),
  };
  const extConfig = extConfigOf(values.extConfig);
  // On an update null means "unchanged" (answers 6 and 78): an empty box is {}, which clears it.
  if (mode === 'update') return { ...common, extConfig: extConfig ?? {} };
  return {
    channelCode: trimSpec(values.channelCode ?? ''),
    ...common,
    extConfig,
    enabled: values.enabled === true,
  };
}
