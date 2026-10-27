// usage: npm run check:codes -- <spec path> <contract path> [exclusions path]
// Finds the permission codes in the two documents again and compares them with PERMISSION_CODES.
// Exit 0 when they agree; exit 1 and the differences otherwise.
import { readFileSync } from 'node:fs';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { extractPermissionCodes, parseExclusions } from './permissionCodes';

const DEFAULT_EXCLUSIONS = 'docs/superpowers/handoff/permission-code-exclusions.txt';

const [specPath, contractPath, exclusionsPath = DEFAULT_EXCLUSIONS] = process.argv.slice(2);
if (!specPath || !contractPath) {
  console.error('usage: npm run check:codes -- <spec path> <contract path> [exclusions path]');
  process.exit(1);
}

const exclusions = parseExclusions(readFileSync(exclusionsPath, 'utf8'));
const { raw, codes } = extractPermissionCodes(
  readFileSync(specPath, 'utf8'),
  readFileSync(contractPath, 'utf8'),
  exclusions,
);

const known = new Set<string>(PERMISSION_CODES);
const found = new Set(codes);
const notListed = codes.filter((code) => !known.has(code));
const notFound = PERMISSION_CODES.filter((code) => !found.has(code));
const staleExclusions = exclusions.filter((word) => !raw.includes(word));

console.log(
  `documents: ${raw.length} code-shaped words, ${exclusions.length} excluded, ${codes.length} codes; PERMISSION_CODES: ${PERMISSION_CODES.length}`,
);
if (notListed.length > 0)
  console.log(`in the documents but not in PERMISSION_CODES: ${notListed.join(', ')}`);
if (notFound.length > 0)
  console.log(`in PERMISSION_CODES but not in the documents: ${notFound.join(', ')}`);
if (staleExclusions.length > 0)
  console.log(`excluded words that no longer appear: ${staleExclusions.join(', ')}`);

if (notListed.length + notFound.length + staleExclusions.length > 0) process.exit(1);
console.log('ok');
