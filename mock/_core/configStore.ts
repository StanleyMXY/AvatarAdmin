// The values saved through `PUT /config/{key}`, kept on `globalThis` like the rest of the mock
// state (see store.ts): saving a mock file does not lose them.
import defaults from './configDefaults.generated.json';
import { EXTRA_DEFAULTS } from './configExtraDefaults';

export type SavedConfig = {
  value: unknown;
  updatedAt: string;
  updatedBy: string;
  updatedByUsername: string;
};

type Holder = { __avatarAdminMockConfig?: Map<string, SavedConfig> };
const holder = globalThis as Holder;
holder.__avatarAdminMockConfig ??= new Map();

export const saved: Map<string, SavedConfig> = holder.__avatarAdminMockConfig;

// Defaults that the contract gives as the address of a third-party service, which the generated
// file leaves empty: the fake backend answers with an address of the example domain instead, so that
// the page can be looked at with a default shown, a changed value and a reset.
const EXAMPLE_DEFAULTS: Record<string, unknown> = {
  'usage_price.source_url': 'https://example.com/model-prices',
};

// The table of the contract wins over the list of extras for a key that is in both; an example
// default fills only a key whose generated default is empty.
export const DEFAULTS: Record<string, unknown> = {
  ...EXTRA_DEFAULTS,
  ...(defaults as Record<string, unknown>),
};
for (const [key, value] of Object.entries(EXAMPLE_DEFAULTS)) {
  if (DEFAULTS[key] === null || DEFAULTS[key] === undefined) DEFAULTS[key] = value;
}

export const defaultOf = (key: string): unknown => DEFAULTS[key] ?? null;

/** The value in force: the saved one, else the default (null when there is neither). */
export const currentValue = (key: string): unknown =>
  saved.has(key) ? (saved.get(key) as SavedConfig).value : defaultOf(key);

export function resetConfigStore(): void {
  saved.clear();
}
