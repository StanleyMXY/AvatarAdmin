// Derives the built-in permission tree from spec table 5.0 (contract 17.3: every page is a MENU
// node, the other codes of that page are its FUNCTION children). The mock backend ships the result
// as data (mock/_core/permissionTree.generated.json); scripts/permissionTree.test.ts keeps the two equal.
import { readTableCells } from './routeInventory';

export type TreeNode = {
  code: string;
  parent: string | null;
  type: 'MENU' | 'FUNCTION';
  sortOrder: number;
};

const CODES_IN_BACKTICKS = /`([A-Z_]+(?::[A-Z_]+)+)`/g;
const ROUTE_IN_BACKTICKS = /`(\/[^`\s]*)`/;
const area = (code: string) => code.split(':')[0];

export function permissionTreeFromSpec(specText: string, codes: readonly string[]): TreeNode[] {
  const known = new Set(codes);
  const menus: string[] = [];
  const functionParents = new Map<string, string[]>();

  for (const cells of readTableCells(specText)) {
    const pageAccess = [...cells[2].matchAll(CODES_IN_BACKTICKS)][0]?.[1] ?? null;
    const hasRoute = ROUTE_IN_BACKTICKS.test(cells[1]);
    if (!hasRoute || pageAccess === null) continue;
    if (known.has(pageAccess) && !menus.includes(pageAccess)) menus.push(pageAccess);
    for (const m of `${cells[2]} ${cells[3]}`.matchAll(CODES_IN_BACKTICKS)) {
      const code = m[1];
      if (code === pageAccess || !known.has(code)) continue;
      const parents = functionParents.get(code) ?? [];
      if (!parents.includes(pageAccess)) parents.push(pageAccess);
      functionParents.set(code, parents);
    }
  }

  const parentOf = new Map<string, string>();
  for (const code of codes) {
    if (menus.includes(code)) continue;
    const candidates = (functionParents.get(code) ?? []).filter((c) => menus.includes(c));
    const parent =
      candidates.find((c) => area(c) === area(code)) ??
      menus.find((c) => area(c) === area(code) && c !== code) ??
      candidates[0];
    if (!parent) throw new Error(`no parent page found for permission code ${code}`);
    parentOf.set(code, parent);
  }

  const nodes: TreeNode[] = [];
  let sortOrder = 1;
  for (const menu of menus) {
    nodes.push({ code: menu, parent: null, type: 'MENU', sortOrder: sortOrder++ });
    for (const code of codes) {
      if (parentOf.get(code) === menu)
        nodes.push({ code, parent: menu, type: 'FUNCTION', sortOrder: sortOrder++ });
    }
  }
  return nodes;
}
