import { PERMISSION_CODES } from '../../access/permissionCodes';
import type { PermissionNode } from '../../services/system';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';

// The rules of the permission tree, as pure functions: which node is built in, which can be chosen
// for a role, how the tree is drawn, what a click on a check box does, and which parents a custom
// node may be moved under. The pages draw what these say.

const REAL_CODES: ReadonlySet<string> = new Set(PERMISSION_CODES);

/**
 * A node counts as built in unless the backend says it is not (`builtin: false`), and a code of the
 * real permission list is built in whatever the backend says: the checks of the application rely on
 * those codes, so they are never deleted or moved from here.
 */
export function isBuiltinNode(node: Pick<PermissionNode, 'code' | 'builtin'>): boolean {
  return node.builtin !== false || REAL_CODES.has(node.code);
}

/**
 * Whether a role may be given this node. Only a code of the real permission list may: the system
 * nodes. A custom node may not (it has no effect on any endpoint, so giving it to a role grants
 * nothing), and neither may a built-in node whose code the application does not have in its list:
 * nothing would check it.
 */
export function isSelectable(node: Pick<PermissionNode, 'code'>): boolean {
  return REAL_CODES.has(node.code);
}

const usable = (name: unknown): name is string => typeof name === 'string' && trimSpec(name) !== '';

/** The name for the interface language, the other language when it has none, the code when neither has. */
export function nodeName(
  node: Pick<PermissionNode, 'code' | 'nameZh' | 'nameEn'>,
  locale: string,
): string {
  const [first, second] = locale.toLowerCase().startsWith('zh')
    ? [node.nameZh, node.nameEn]
    : [node.nameEn, node.nameZh];
  if (usable(first)) return first;
  if (usable(second)) return second;
  return node.code;
}

export type TreeIndex = {
  /** The nodes by code; of two nodes with one code the first is kept. */
  byCode: Map<string, PermissionNode>;
  /** Every code once, in the order the nodes came. */
  codes: string[];
  /** The parent as the tree draws it: null for a root, also for a node whose parent is not there or loops. */
  parentOf: Map<string, string | null>;
  /** The children of each node by sortOrder, then code. */
  childrenOf: Map<string, string[]>;
  roots: string[];
};

const bySortThenCode = (byCode: Map<string, PermissionNode>) => (a: string, b: string) => {
  const x = byCode.get(a) as PermissionNode;
  const y = byCode.get(b) as PermissionNode;
  return (Number(x.sortOrder) || 0) - (Number(y.sortOrder) || 0) || (a < b ? -1 : a > b ? 1 : 0);
};

/**
 * Builds the tree from the flat list of the backend. It never fails on a list that is not a tree: a
 * parent that is not in the list makes a root, and nodes that form a loop (or are under themselves)
 * all become roots, so that every node is drawn once and nothing recurses for ever.
 */
export function buildIndex(nodes: readonly PermissionNode[]): TreeIndex {
  const byCode = new Map<string, PermissionNode>();
  for (const node of nodes) if (!byCode.has(node.code)) byCode.set(node.code, node);
  const rawParent = (code: string): string | null => {
    const parent = (byCode.get(code) as PermissionNode).parent;
    return typeof parent === 'string' && byCode.has(parent) ? parent : null;
  };
  const parentOf = new Map<string, string | null>();
  for (const code of byCode.keys()) {
    // Walk up; arriving at the node again means it is part of a loop. A node under a loop but not in
    // it never arrives back, so the walk stops after as many steps as there are nodes.
    let current = rawParent(code);
    let steps = 0;
    let loops = false;
    while (current !== null && steps <= byCode.size) {
      if (current === code) {
        loops = true;
        break;
      }
      current = rawParent(current);
      steps += 1;
    }
    parentOf.set(code, loops ? null : rawParent(code));
  }
  const childrenOf = new Map<string, string[]>();
  const roots: string[] = [];
  for (const code of byCode.keys()) {
    childrenOf.set(code, []);
  }
  for (const code of byCode.keys()) {
    const parent = parentOf.get(code) ?? null;
    if (parent === null) roots.push(code);
    else (childrenOf.get(parent) as string[]).push(code);
  }
  const order = bySortThenCode(byCode);
  roots.sort(order);
  for (const children of childrenOf.values()) children.sort(order);
  return { byCode, codes: [...byCode.keys()], parentOf, childrenOf, roots };
}

/** Every node below `code`, children first-level then deeper (no order promised). */
export function descendantsOf(index: TreeIndex, code: string): string[] {
  const found: string[] = [];
  const stack = [...(index.childrenOf.get(code) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    found.push(current);
    stack.push(...(index.childrenOf.get(current) ?? []));
  }
  return found;
}

/** The nodes above `code`, the nearest first. */
export function ancestorsOf(index: TreeIndex, code: string): string[] {
  const found: string[] = [];
  let current = index.parentOf.get(code) ?? null;
  while (current !== null) {
    found.push(current);
    current = index.parentOf.get(current) ?? null;
  }
  return found;
}

export type CheckState = 'checked' | 'half' | 'none';

const selectableSet = (index: TreeIndex): Set<string> =>
  new Set(index.codes.filter((code) => isSelectable(index.byCode.get(code) as PermissionNode)));

/** The codes of `value` that are nodes a role may have, as a set. */
const chosenIn = (index: TreeIndex, value: readonly string[]): Set<string> => {
  const selectable = selectableSet(index);
  return new Set(value.filter((code) => selectable.has(code)));
};

function stateIn(index: TreeIndex, chosen: ReadonlySet<string>, code: string): CheckState {
  if (chosen.has(code)) return 'checked';
  return descendantsOf(index, code).some((c) => chosen.has(c)) ? 'half' : 'none';
}

/**
 * How the box of a node looks. A node is checked when its code is in the value, exactly: a role
 * that holds a page code and none of the codes below it shows the page checked and the rest not.
 * A node that is not in the value but has a descendant in it is half checked.
 */
export function stateOf(
  nodes: readonly PermissionNode[] | TreeIndex,
  value: readonly string[],
  code: string,
): CheckState {
  const index = Array.isArray(nodes) ? buildIndex(nodes) : (nodes as TreeIndex);
  return stateIn(index, chosenIn(index, value), code);
}

/**
 * The value after a click on the box of `code` (the complete, sorted list of codes).
 * - Checking a node checks it and every descendant that may be chosen, and every node above it that
 *   may be chosen (the pages it is on), the rest of what is below those nodes left as it was.
 * - Unchecking a node (it was checked) takes out the node and every descendant. The nodes above it
 *   keep their codes: a role may hold a page and only a part of the functions of that page, and
 *   taking one function away must not take the page away. A node above leaves the value only when
 *   the person unchecks that node itself.
 * - A click on a node that is not there or may not be chosen changes nothing.
 * - With `grantable` (the codes the signed-in administrator holds, when they are not a super
 *   administrator) only those nodes can be changed: a node outside it is never checked or unchecked
 *   by a click on another node, and a click on it changes nothing. The backend refuses a role with a
 *   code the administrator does not hold, so this only keeps the page from offering it.
 * Codes in `value` that are not nodes a role may have are dropped.
 */
export function toggleCode(
  nodes: readonly PermissionNode[] | TreeIndex,
  value: readonly string[],
  code: string,
  grantable?: ReadonlySet<string> | null,
): string[] {
  const index = Array.isArray(nodes) ? buildIndex(nodes) : (nodes as TreeIndex);
  const selectable = selectableSet(index);
  const mayChange = (c: string) => selectable.has(c) && (!grantable || grantable.has(c));
  const chosen = chosenIn(index, value);
  if (!mayChange(code)) return [...chosen].sort();
  const below = descendantsOf(index, code);
  const above = ancestorsOf(index, code);
  if (stateIn(index, chosen, code) === 'checked') {
    chosen.delete(code);
    for (const c of below) if (!grantable || grantable.has(c)) chosen.delete(c);
  } else {
    chosen.add(code);
    for (const c of below) if (mayChange(c)) chosen.add(c);
    // A function cannot be used without the page it is on: every node above that may be chosen comes
    // with it, whether or not the rest of what is below that node is checked.
    for (const c of above) if (mayChange(c)) chosen.add(c);
  }
  return [...chosen].sort();
}

/** Would giving `code` the parent `parent` make a loop: under itself, or under something below it? */
export function wouldCreateCycle(
  nodes: readonly PermissionNode[] | TreeIndex,
  code: string,
  parent: string | null,
): boolean {
  if (parent === null) return false;
  if (parent === code) return true;
  const index = Array.isArray(nodes) ? buildIndex(nodes) : (nodes as TreeIndex);
  return descendantsOf(index, code).includes(parent);
}

/** The nodes `code` may be moved under: every node except itself and the nodes below it. */
export function parentCandidates(nodes: readonly PermissionNode[], code: string): string[] {
  const index = buildIndex(nodes);
  const blocked = new Set([code, ...descendantsOf(index, code)]);
  return index.codes.filter((c) => !blocked.has(c));
}

/**
 * The codes of a role that the signed-in administrator does not hold, each once and written as
 * plain text, in the order the role has them (what the backend sends is not trusted to be text).
 * The backend refuses to save a role that has any of them, so the dialog says so beforehand.
 * `held` is null for a super administrator, who holds everything, and when it is not known.
 */
export function codesNotHeld(
  roleCodes: readonly unknown[],
  held: ReadonlySet<string> | null,
): string[] {
  if (held === null) return [];
  const seen = new Set<string>();
  for (const raw of roleCodes) {
    const code = plainText(raw);
    if (code !== '' && !held.has(code)) seen.add(code);
  }
  return [...seen];
}
