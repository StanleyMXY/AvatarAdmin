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

type Holder = {
  __avatarAdminMockConfig?: Map<string, SavedConfig>;
  __avatarAdminMockDeployEnv?: { production: boolean };
};
const holder = globalThis as Holder;
holder.__avatarAdminMockConfig ??= new Map();
holder.__avatarAdminMockDeployEnv ??= { production: true };

export const saved: Map<string, SavedConfig> = holder.__avatarAdminMockConfig;

/**
 * Whether the fake backend plays a production deployment (`DEPLOY_ENV=PRODUCTION`, contract 1.5). It
 * does by default, so that the checks that only production makes, such as refusing to save
 * `admin.totp_required` as false, can be seen. A test turns it off with `deployEnv.production = false`.
 */
export const deployEnv: { production: boolean } = holder.__avatarAdminMockDeployEnv;

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
  deployEnv.production = true;
}
