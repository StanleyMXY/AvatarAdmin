// usage: npm run check:routes -- <spec path> [--prefix /path]...
// Compares the page routes of spec table 5.0 with the assembled config/routes: missing, extra and
// different access. Exit 0 when all three are empty. With --prefix only paths starting with it are
// compared (a module task looks at its own part). Until every module has filled its route file the
// full check reports their routes as missing.
import { readFileSync } from 'node:fs';
import { flattenPages } from '../config/assembleRoutes';
import routes from '../config/routes';
import { compareRoutes, parseRouteTable } from './routeInventory';

const args = process.argv.slice(2);
const prefixes: string[] = [];
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prefix') prefixes.push(args[++i] ?? '');
  else positional.push(args[i]);
}
if (positional.length !== 1 || prefixes.includes('')) {
  console.error('usage: npm run check:routes -- <spec path> [--prefix /path]...');
  process.exit(1);
}

const table = parseRouteTable(readFileSync(positional[0], 'utf8'));
const pages = flattenPages(routes);
const result = compareRoutes(table.routes, pages, {
  prefixes: prefixes.length > 0 ? prefixes : undefined,
});

console.log(
  `spec: ${table.rows} rows, ${table.rowsWithoutRoute.length} without a page route, ${table.routes.length} page routes; config/routes: ${pages.length} page routes${prefixes.length > 0 ? `; limited to ${prefixes.join(', ')}` : ''}`,
);
console.log(`missing (${result.missing.length}):${result.missing.map((p) => `\n  ${p}`).join('')}`);
console.log(`extra (${result.extra.length}):${result.extra.map((p) => `\n  ${p}`).join('')}`);
console.log(
  `access mismatch (${result.accessMismatch.length}):${result.accessMismatch
    .map(
      (m) =>
        `\n  ${m.path}: spec ${m.spec ?? 'sign-in only'}, routes ${m.routes ?? 'sign-in only'}`,
    )
    .join('')}`,
);

const problems = result.missing.length + result.extra.length + result.accessMismatch.length;
if (problems > 0) process.exit(1);
console.log('ok');
