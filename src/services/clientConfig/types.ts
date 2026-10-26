export const CLIENT_CONFIG_TYPES = [
  'URL',
  'EMAIL',
  'STRING',
  'BOOLEAN',
  'INT',
  'STRING_LIST',
] as const;
export type ClientConfigType = (typeof CLIENT_CONFIG_TYPES)[number];

/**
 * The value of one language of a key. Its JSON type is the one `PUT` accepts at that place: text
 * for `URL`, `EMAIL`, `STRING`; a boolean for `BOOLEAN`; a number for `INT`; an array of texts for
 * `STRING_LIST` (read only). Anything else the backend might send is shown as text by the page.
 */
export type ClientConfigValue = string | number | boolean | string[];

/** The language tag of the default value is the empty string. */
export const DEFAULT_LANGUAGE = '';

/**
 * One registered key of `GET /client-config` (backend reply 2, item 1). `values` is
 * `{"<language tag>": value}`: `""` is the default value, `{}` means not configured; a key that is
 * not `localized` has only `""`; a `readOnly` key has `{"": <the current system configuration value>}`.
 */
export type ClientConfigItem = {
  key: string;
  type: ClientConfigType | string;
  localized: boolean;
  readOnly: boolean;
  configured: boolean;
  defaultValue: ClientConfigValue | null;
  values: Record<string, ClientConfigValue>;
  updatedBy: string | null;
  updatedByUsername: string | null;
  updatedAt: string | null;
};
