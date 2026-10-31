// Usage: npm run check:config-keys -- <contract path>
// Compares the key table of contract 17.5 with configKeys.generated.json and with CONFIG_SCHEMA
// (same keys, same edit permission). Exits 1 when they differ.
// The keys the backend has before the contract lists them (EXTRA_ENTRIES, one list of their
// own in src/pages/config/extraConfigKeys.ts) are expected in the schema on top of the table and
// do not fail the check; one the contract lists by now is reported, so it leaves the list.
import { readFileSync } from 'node:fs';
import generated from '../src/pages/config/configKeys.generated.json';
import { CONFIG_SCHEMA } from '../src/pages/config/configSchema';
import { EXTRA_ENTRIES } from '../src/pages/config/extraConfigKeys';
import { parseConfigRows } from './configKeys';
import { compareConfigKeys } from './configKeysCheck';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run check:config-keys -- <contract path>');
  process.exit(2);
}
const rows = parseConfigRows(readFileSync(path, 'utf8'));
const schema = CONFIG_SCHEMA.map((s) => ({ key: s.key, editPermission: s.editPermission }));
const problems = compareConfigKeys(
  rows.map((r) => ({ key: r.key, editPermission: r.editPermission })),
  generated,
  schema,
  EXTRA_ENTRIES.map((e) => ({ key: e.key, editPermission: e.editPermission })),
);
console.log(
  `contract: ${rows.length} keys, generated file: ${generated.length}, backend extra keys: ${EXTRA_ENTRIES.length}, schema: ${CONFIG_SCHEMA.length}`,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(
  'config keys: contract, generated file and schema agree (the schema also has the backend extra keys)',
);
