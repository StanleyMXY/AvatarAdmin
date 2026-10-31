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

/** One row of the credentials as the form holds it. */
export type CredentialRow = { name?: string; value?: string };

export type CredentialProblem = { name?: 'REQUIRED' | 'DUPLICATE'; value?: 'REQUIRED' } | null;

const filled = (text: string | undefined): boolean => trimSpec(text ?? '') !== '';

/**
 * What is wrong with each row: a name without a value, a value without a name, a name used by an
 * earlier row (compared after the ends are cut, and in the case typed). A row with neither is left
 * out of the request and has no problem.
 */
export function credentialProblems(
  rows: readonly CredentialRow[] | undefined,
): CredentialProblem[] {
  const seen = new Set<string>();
  return (rows ?? []).map((row) => {
    const hasName = filled(row?.name);
    const hasValue = filled(row?.value);
    if (!hasName && !hasValue) return null;
    if (!hasName) return { name: 'REQUIRED' };
    if (!hasValue) return { value: 'REQUIRED' };
    const name = trimSpec(row.name as string);
    if (seen.has(name)) return { name: 'DUPLICATE' };
    seen.add(name);
    return null;
  });
}

export type ChannelFormValues = {
  channelCode?: string;
  name: string;
  providerCode: string;
  apiUrl: string;
  credentials?: CredentialRow[];
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

export function buildChannelBody(values: ChannelFormValues, mode: 'create'): ChannelInput;
export function buildChannelBody(values: ChannelFormValues, mode: 'update'): ChannelPatch;
export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'create' | 'update',
): ChannelInput | ChannelPatch;
/**
 * The body of a create or an update. The credentials are in it only when a whole row was typed
 * (a name and a value); no row, or rows left blank, leaves the key out, so that the backend keeps
 * what it holds. With rows, the map replaces everything stored.
 * An update has neither the code nor the switch: the code cannot change, and the switch has its own
 * request.
 */
export function buildChannelBody(
  values: ChannelFormValues,
  mode: 'create' | 'update',
): ChannelInput | ChannelPatch {
  // Whole rows only, as a map of names to text values; a row left blank is not sent.
  const credentials = Object.fromEntries(
    (values.credentials ?? [])
      .filter((row) => filled(row?.name) && filled(row?.value))
      .map((row) => [trimSpec(row.name as string), trimSpec(row.value as string)]),
  );
  const common = {
    name: trimSpec(values.name),
    providerCode: values.providerCode,
    apiUrl: trimSpec(values.apiUrl),
    extConfig: extConfigOf(values.extConfig),
    countries: normalizeCountries(values.countries),
    smsType: values.smsType,
    priority: values.priority,
    ...(Object.keys(credentials).length === 0 ? {} : { credentials }),
  };
  if (mode === 'update') return common;
  return {
    channelCode: trimSpec(values.channelCode ?? ''),
    ...common,
    enabled: values.enabled === true,
  };
}
