// usage: npm run check:routes -- <spec path> [--prefix /path]...
// Compares the page routes of spec table 5.0 with the assembled config/routes: missing, extra and
// different access. Exit 0 when all three are empty. With --prefix only paths starting with it are
// compared (a module task looks at its own part). Until every module has filled its route file the
// full check reports their routes as missing.
import { readFileSync } from 'node:fs';
import { flattenPages } from '../config/assembleRoutes';
import routes from '../config/routes';
import { runRouteInventory } from './routeInventory';

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

const { output, ok } = runRouteInventory(
  readFileSync(positional[0], 'utf8'),
  flattenPages(routes),
  prefixes,
);
console.log(output);
if (!ok) process.exit(1);
