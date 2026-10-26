import type { ChainNode } from '../../services/invite';
import { plainText } from '../../utils/plainText';

export type TreeRow = {
  key: string;
  label: string;
  /** The raw time text of the node; empty when there is none. */
  time: string;
  children: TreeRow[];
};

const rowOf = (node: ChainNode, key: string): TreeRow => ({
  key,
  label: plainText(node?.label),
  time: plainText(node?.joinedAt),
  children: Array.isArray(node?.children)
    ? node.children.map((child, index) => rowOf(child, `${key}-${index}`))
    : [],
});

/** The root and its descendants as rows for the tree. Keys come from the position, never from an account id. */
export function treeRows(root: ChainNode, children: ChainNode[] | undefined): TreeRow[] {
  const top = rowOf(root, '0');
  top.children = Array.isArray(children)
    ? children.map((child, index) => rowOf(child, `0-${index}`))
    : [];
  return [top];
}

/** The number of nodes below a row. */
export const descendantsOf = (row: TreeRow): number =>
  row.children.reduce((n, child) => n + 1 + descendantsOf(child), 0);

/** How many levels of nodes lie below a row (0 for a row without children). */
export const levelsBelow = (row: TreeRow): number =>
  row.children.reduce((deepest, child) => Math.max(deepest, 1 + levelsBelow(child)), 0);
