// Usage: npm run gen:config-keys -- <contract path>
// Rewrites the two files that come from the key table of contract 17.5:
//   src/pages/config/configKeys.generated.json   the keys and their edit permission (the check
//                                                script compares the schema with it)
//   mock/_core/configDefaults.generated.json     the defaults the mock backend reports
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { defaultValueOf, parseConfigRows } from './configKeys';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run gen:config-keys -- <contract path>');
  process.exit(2);
}
const rows = parseConfigRows(readFileSync(path, 'utf8'));
writeFileSync(
  'src/pages/config/configKeys.generated.json',
  `${JSON.stringify(
    rows.map((r) => ({ key: r.key, editPermission: r.editPermission })),
    null,
    1,
  )}\n`,
);
writeFileSync(
  'mock/_core/configDefaults.generated.json',
  `${JSON.stringify(Object.fromEntries(rows.map((r) => [r.key, defaultValueOf(r)])), null, 1)}\n`,
);
// The files are committed in the form the formatter writes, so the commit hook accepts them.
execFileSync(
  'npx',
  [
    'biome',
    'format',
    '--write',
    'src/pages/config/configKeys.generated.json',
    'mock/_core/configDefaults.generated.json',
  ],
  { stdio: 'ignore' },
);
console.log(`${rows.length} keys`);
