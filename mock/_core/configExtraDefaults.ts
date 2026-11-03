// The defaults the fake backend reports for the keys that contract 17.5 does not list yet (the list
// of the keys is src/pages/config/extraConfigKeys.ts). When the contract adopts a key it is generated
// into configDefaults.generated.json and its line goes from here. Empty: the contract lists all of
// the backend's keys (see extraConfigKeys.ts).
export const EXTRA_DEFAULTS: Record<string, unknown> = {};
