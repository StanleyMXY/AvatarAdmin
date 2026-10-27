// Reads the route table (spec 5.0) and compares it with the routes of config/routes.

export type SpecRoute = { path: string; access: string | null; menu: string };

export type RouteTable = {
  /** Data rows of the table. */
  rows: number;
  /** Rows that have no page route (the export row), as text. */
  rowsWithoutRoute: string[];
  routes: SpecRoute[];
};

const ROUTE_IN_BACKTICKS = /`(\/[^`\s]*)`/g;
const CODE_IN_BACKTICKS = /`([A-Z_]+(?::[A-Z_]+)+)`/;

/** The cells of every data row of table 5.0 (four cells each), without the header. */
export function readTableCells(spec: string): string[][] {
  const lines = spec.split('\n');
  const start = lines.findIndex((line) => line.startsWith('### 5.0 '));
  if (start === -1) throw new Error('table 5.0 (路由总表) not found in the spec');

  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  i += 2; // header row and the separator row

  const rows: string[][] = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 4)
      throw new Error(`row has ${cells.length} cells, expected 4: ${lines[i]}`);
    rows.push(cells);
  }
  return rows;
}

export function parseRouteTable(spec: string): RouteTable {
  const routes: SpecRoute[] = [];
  const rowsWithoutRoute: string[] = [];
  const cellRows = readTableCells(spec);
  let menu = '';
  for (const cells of cellRows) {
    if (cells[0] !== '') menu = cells[0];
    const paths = [...cells[1].matchAll(ROUTE_IN_BACKTICKS)].map((m) => m[1]);
    if (paths.length === 0) {
      rowsWithoutRoute.push(cells.join(' | '));
      continue;
    }
    const access = CODE_IN_BACKTICKS.exec(cells[2])?.[1] ?? null;
    for (const path of paths) routes.push({ path, access, menu });
  }
  return { rows: cellRows.length, rowsWithoutRoute, routes };
}

export type AccessMismatch = { path: string; spec: string | null; routes: string | null };

export type Comparison = { missing: string[]; extra: string[]; accessMismatch: AccessMismatch[] };

/** Missing: in the table, not in the routes. Extra: the reverse. Mismatch: both, different access. */
export function compareRoutes(
  spec: readonly SpecRoute[],
  pages: readonly { path: string; access: string | null }[],
  options: { prefixes?: string[] } = {},
): Comparison {
  const wanted = (path: string) =>
    !options.prefixes || options.prefixes.some((prefix) => path.startsWith(prefix));
  const specByPath = new Map(spec.filter((r) => wanted(r.path)).map((r) => [r.path, r.access]));
  const pageByPath = new Map(pages.filter((p) => wanted(p.path)).map((p) => [p.path, p.access]));

  const missing = [...specByPath.keys()].filter((path) => !pageByPath.has(path));
  const extra = [...pageByPath.keys()].filter((path) => !specByPath.has(path));
  const accessMismatch: AccessMismatch[] = [];
  for (const [path, specAccess] of specByPath) {
    if (!pageByPath.has(path)) continue;
    const routesAccess = pageByPath.get(path) ?? null;
    if (routesAccess !== specAccess)
      accessMismatch.push({ path, spec: specAccess, routes: routesAccess });
  }
  return { missing, extra, accessMismatch };
}

/** The text report of a comparison and whether it is clean (exit code 0). */
export function runRouteInventory(
  specText: string,
  pages: readonly { path: string; access: string | null }[],
  prefixes: string[] = [],
): { output: string; ok: boolean } {
  const table = parseRouteTable(specText);
  const result = compareRoutes(table.routes, pages, {
    prefixes: prefixes.length > 0 ? prefixes : undefined,
  });
  const list = (paths: string[]) => paths.map((path) => `\n  ${path}`).join('');
  const limited = prefixes.length > 0 ? `; limited to ${prefixes.join(', ')}` : '';
  const output = [
    `spec: ${table.rows} rows, ${table.rowsWithoutRoute.length} without a page route, ${table.routes.length} page routes; config/routes: ${pages.length} page routes${limited}`,
    `missing (${result.missing.length}):${list(result.missing)}`,
    `extra (${result.extra.length}):${list(result.extra)}`,
    `access mismatch (${result.accessMismatch.length}):${result.accessMismatch
      .map(
        (m) =>
          `\n  ${m.path}: spec ${m.spec ?? 'sign-in only'}, routes ${m.routes ?? 'sign-in only'}`,
      )
      .join('')}`,
  ].join('\n');
  const ok = result.missing.length + result.extra.length + result.accessMismatch.length === 0;
  return { output: ok ? `${output}\nok` : output, ok };
}
