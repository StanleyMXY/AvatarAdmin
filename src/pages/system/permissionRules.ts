import type { PermissionNode, PermissionPatch } from '../../services/system';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { isBuiltinNode, wouldCreateCycle } from './permissionTree';

export type PatchResult =
  | { ok: true; patch: PermissionPatch }
  | { ok: false; reason: 'loop' | 'builtinParent' };

/**
 * The request for the edit of a node. The code and the type never change. A built-in node keeps its
 * parent (the checks of the application rely on the tree as the code declares it): asking for another
 * parent is refused here and never sent. A custom node may get another parent, but not itself and not
 * one of its own descendants: that would make a loop in the tree. This is the second line after the
 * choice of parents in the dialog, which does not offer them.
 */
export function buildPermissionPatch(
  nodes: readonly PermissionNode[],
  node: PermissionNode,
  values: { nameZh: string; nameEn: string; sortOrder: number; parent: string | null },
): PatchResult {
  const patch: PermissionPatch = {
    nameZh: trimSpec(values.nameZh),
    nameEn: trimSpec(values.nameEn),
    sortOrder: values.sortOrder,
  };
  const moved = values.parent !== (node.parent ?? null);
  if (moved) {
    if (isBuiltinNode(node)) return { ok: false, reason: 'builtinParent' };
    if (wouldCreateCycle(nodes, node.code, values.parent)) return { ok: false, reason: 'loop' };
    patch.parent = values.parent;
  }
  return { ok: true, patch };
}

// White space, control characters, format characters (zero width, bidi) and the other separators.
const NOT_ALLOWED_IN_CODE = /[\s\p{Cc}\p{Cf}\p{Z}]/u;
const MAX_CODE_POINTS = 100;

/**
 * What is wrong with the code of a new node, if anything: it is missing, it has a character that does
 * not belong in a code (the code is also a path segment and is shown in the tree), or it is taken.
 * The backend decides on the real rules; the contract gives none, so these are the least that keep a
 * code readable.
 */
export function codeProblem(
  raw: string,
  nodes: readonly PermissionNode[],
): 'required' | 'invalid' | 'taken' | null {
  const code = trimSpec(raw);
  if (code === '') return 'required';
  if (NOT_ALLOWED_IN_CODE.test(code) || countCodePoints(code) > MAX_CODE_POINTS) return 'invalid';
  if (nodes.some((n) => n.code === code)) return 'taken';
  return null;
}
