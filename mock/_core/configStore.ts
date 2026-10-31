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

// The table of the contract wins over the list of extras for a key that is in both.
export const DEFAULTS = { ...EXTRA_DEFAULTS, ...(defaults as Record<string, unknown>) };

export const defaultOf = (key: string): unknown => DEFAULTS[key] ?? null;

/** The value in force: the saved one, else the default (null when there is neither). */
export const currentValue = (key: string): unknown =>
  saved.has(key) ? (saved.get(key) as SavedConfig).value : defaultOf(key);

export function resetConfigStore(): void {
  saved.clear();
}
