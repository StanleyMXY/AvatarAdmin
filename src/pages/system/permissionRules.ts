import type { PermissionNode, PermissionPatch } from '../../services/system';
import { trimSpec } from '../../utils/trimSpec';
import { buildIndex, isBuiltinNode, wouldCreateCycle } from './permissionTree';

export type PatchResult =
  | { ok: true; patch: PermissionPatch }
  | { ok: false; reason: 'loop' | 'builtinParent' };

/**
 * The request for the edit of a node. The code and the type never change. The parent is always in the
 * request, the current one when the node is not moved (null for a root): the backend reads a missing
 * parent as null, which would move a custom node to the root and be refused for a built-in node (its
 * answer 87). A built-in node keeps its parent (the checks of the application rely on the tree as the
 * code declares it): asking for another parent is refused here and never sent. A custom node may get
 * another parent, but not itself and not one of its own descendants: that would make a loop in the
 * tree. This is the second line after the choice of parents in the dialog, which does not offer them.
 */
export function buildPermissionPatch(
  nodes: readonly PermissionNode[],
  node: PermissionNode,
  values: { nameZh: string; nameEn: string; sortOrder: number; parent: string | null },
): PatchResult {
  const current = node.parent ?? null;
  const patch: PermissionPatch = {
    nameZh: trimSpec(values.nameZh),
    nameEn: trimSpec(values.nameEn),
    sortOrder: values.sortOrder,
    parent: current,
  };
  if (values.parent !== current) {
    if (isBuiltinNode(node)) return { ok: false, reason: 'builtinParent' };
    if (wouldCreateCycle(nodes, node.code, values.parent)) return { ok: false, reason: 'loop' };
    patch.parent = values.parent;
  }
  return { ok: true, patch };
}

// What the backend takes as a code (its answer 87): 1 to 128 ASCII letters, digits and `_ : # / . -`.
const CODE_FORMAT = /^[A-Za-z0-9_:#/.-]{1,128}$/;

/**
 * What is wrong with the code of a new node, if anything: it is missing, it is not of the form the
 * backend takes (`[A-Za-z0-9_:#/.-]{1,128}`, case sensitive), it is made only of dots, or it is taken.
 * A dot anywhere else is fine, at either end too. A code that is only dots (`.`, `..`) is a path
 * segment that URLs read as "this folder" and "the folder above" (`encodeURIComponent` leaves a dot
 * alone), so the edit and delete requests of such a node would go to another address: the page does
 * not make such a node, though the backend would take it. The backend decides on the rest.
 */
export function codeProblem(
  raw: string,
  nodes: readonly PermissionNode[],
): 'required' | 'invalid' | 'dots' | 'taken' | null {
  const code = trimSpec(raw);
  if (code === '') return 'required';
  if (!CODE_FORMAT.test(code)) return 'invalid';
  if (/^\.+$/.test(code)) return 'dots';
  if (nodes.some((n) => n.code === code)) return 'taken';
  return null;
}

/**
 * The order offered for a new node under `parent` (null: a root): one more than the last of the
 * nodes under the same parent, so the node comes last among its siblings; 1 when there is none.
 * The siblings are the nodes as the tree draws them (a node whose parent is not in the list is a
 * root). An order that is not a number is ignored; the result stays a safe integer.
 */
export function nextSortOrder(nodes: readonly PermissionNode[], parent: string | null): number {
  const index = buildIndex(nodes);
  const siblings = parent === null ? index.roots : (index.childrenOf.get(parent) ?? []);
  const orders = siblings
    .map((code) => (index.byCode.get(code) as PermissionNode).sortOrder)
    .filter((order): order is number => typeof order === 'number' && Number.isFinite(order));
  if (orders.length === 0) return 1;
  return Math.min(Math.floor(Math.max(...orders)) + 1, Number.MAX_SAFE_INTEGER);
}
