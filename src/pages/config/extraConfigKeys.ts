import type { ConfigKeySpec } from './configSchema';

// The settings the backend has that contract 17.5 does not list yet. `GET /config` returns them, so
// the page knows them and the check script lets them pass. When the contract adopts a key, delete
// its entry here, run `npm run gen:config-keys` and put the entry into the entries of the table in
// configSchema.ts in the order of the table; the check script says so ("is in the contract now").
// The schema holds no default: `GET /config` reports it. The fake backend keeps its defaults for
// these keys in mock/_core/configExtraDefaults.ts.
//
// The list is empty: the contract of AvatarApp main at e9db4213 (2026-11-04) lists all 251 keys of
// the backend, among them the 26 that were here before.

type Extra = Omit<ConfigKeySpec, 'validate'>;

export const EXTRA_ENTRIES: Extra[] = [];
