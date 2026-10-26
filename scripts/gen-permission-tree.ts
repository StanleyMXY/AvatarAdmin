// usage: npm run gen:permission-tree -- <spec path>
// Rewrites mock/_core/permissionTree.generated.json from spec table 5.0 and PERMISSION_CODES. Run it
// when the spec snapshot changes and mock/_core/permissions.test.ts reports a difference.
import { readFileSync, writeFileSync } from 'node:fs';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { permissionTreeFromSpec } from './permissionTree';

const OUTPUT = 'mock/_core/permissionTree.generated.json';
const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: npm run gen:permission-tree -- <spec path>');
  process.exit(1);
}
const nodes = permissionTreeFromSpec(readFileSync(specPath, 'utf8'), PERMISSION_CODES);
writeFileSync(OUTPUT, `${JSON.stringify(nodes, null, 2)}\n`);
console.log(`${nodes.length} nodes written to ${OUTPUT}`);
