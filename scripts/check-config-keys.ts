// Usage: npm run check:config-keys -- <contract path>
// Compares the key table of contract 17.5 with configKeys.generated.json and with CONFIG_SCHEMA
// (same keys, same edit permission). Exits 1 when they differ.
import { readFileSync } from 'node:fs';
import generated from '../src/pages/config/configKeys.generated.json';
import { CONFIG_SCHEMA } from '../src/pages/config/configSchema';
import { parseConfigRows } from './configKeys';
import { compareConfigKeys } from './configKeysCheck';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run check:config-keys -- <contract path>');
  process.exit(2);
}
const rows = parseConfigRows(readFileSync(path, 'utf8'));
const problems = compareConfigKeys(
  rows.map((r) => ({ key: r.key, editPermission: r.editPermission })),
  generated,
  CONFIG_SCHEMA.map((s) => ({ key: s.key, editPermission: s.editPermission })),
);
console.log(
  `contract: ${rows.length} keys, generated file: ${generated.length}, schema: ${CONFIG_SCHEMA.length}`,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log('config keys: contract, generated file and schema agree');
