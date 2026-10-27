import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import type { PermissionNode } from '../../services/system';
import {
  buildIndex,
  isBuiltinNode,
  isSelectable,
  nodeName,
  parentCandidates,
  stateOf,
  toggleCode,
  wouldCreateCycle,
} from './permissionTree';

const node = (
  code: string,
  parent: string | null,
  over: Partial<PermissionNode> = {},
): PermissionNode => ({
  code,
  parent,
  type: parent === null ? 'MENU' : 'FUNCTION',
  sortOrder: 0,
  nameZh: `${code}-zh`,
  nameEn: `${code}-en`,
  builtin: false,
  ...over,
});

// ---- a small seeded random generator, so that a failing case can be run again ----
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];

/** A random forest: every node has a parent among the nodes before it, or none. A tenth cannot be chosen. */
function randomForest(rand: () => number): PermissionNode[] {
  const size = 1 + Math.floor(rand() * 24);
  const nodes: PermissionNode[] = [];
  for (let i = 0; i < size; i += 1) {
    const parent = i === 0 || rand() < 0.25 ? null : nodes[Math.floor(rand() * i)].code;
    // A built-in node whose code the application does not know cannot be chosen; a custom one can.
    const unknownBuiltin = rand() < 0.1;
    nodes.push(
      node(`N${i}`, parent, { builtin: unknownBuiltin, sortOrder: Math.floor(rand() * 5) }),
    );
  }
  // shuffle: the order of the backend's answer carries no meaning
  for (let i = nodes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
  }
  return nodes;
}

// ---- the reference: the same rules written on nested objects, without the index of the code under test ----
type RefNode = { code: string; selectable: boolean; children: RefNode[] };

function nest(nodes: PermissionNode[]): RefNode[] {
  const make = (n: PermissionNode): RefNode => ({
    code: n.code,
    selectable: !(n.builtin && !(PERMISSION_CODES as readonly string[]).includes(n.code)),
    children: nodes.filter((c) => c.parent === n.code).map(make),
  });
  return nodes.filter((n) => n.parent === null).map(make);
}
const flatten = (n: RefNode): RefNode[] => [n, ...n.children.flatMap(flatten)];
function pathTo(roots: RefNode[], code: string, trail: RefNode[] = []): RefNode[] | null {
  for (const root of roots) {
    const here = [...trail, root];
    if (root.code === code) return here;
    const deeper = pathTo(root.children, code, here);
    if (deeper) return deeper;
  }
  return null;
}
function refState(roots: RefNode[], set: Set<string>, code: string): 'checked' | 'half' | 'none' {
  if (set.has(code)) return 'checked';
  const path = pathTo(roots, code) as RefNode[];
  const below = flatten(path[path.length - 1]).slice(1);
  return below.some((n) => set.has(n.code)) ? 'half' : 'none';
}
function refToggle(roots: RefNode[], set: Set<string>, code: string): Set<string> {
  const path = pathTo(roots, code);
  const out = new Set(set);
  if (!path) return out;
  const target = path[path.length - 1];
  if (!target.selectable) return out;
  if (refState(roots, set, code) === 'checked') {
    for (const n of flatten(target)) out.delete(n.code);
    for (const a of path.slice(0, -1)) out.delete(a.code);
  } else {
    for (const n of flatten(target)) if (n.selectable) out.add(n.code);
    for (let i = path.length - 2; i >= 0; i -= 1) {
      const a = path[i];
      const below = flatten(a)
        .slice(1)
        .filter((n) => n.selectable);
      if (a.selectable && below.every((n) => out.has(n.code))) out.add(a.code);
    }
  }
  return out;
}

describe('the names of the nodes', () => {
  const both = node('A:B', null, { nameZh: '中文名', nameEn: 'English name' });
  it('takes the name of the interface language', () => {
    expect(nodeName(both, 'zh-CN')).toBe('中文名');
    expect(nodeName(both, 'en-US')).toBe('English name');
  });
  it('takes the other language when one is missing, and the code when both are', () => {
    expect(nodeName({ ...both, nameZh: null }, 'zh-CN')).toBe('English name');
    expect(nodeName({ ...both, nameEn: '' }, 'en-US')).toBe('中文名');
    expect(nodeName({ ...both, nameZh: '  ', nameEn: null }, 'zh-CN')).toBe('A:B');
    expect(
      nodeName({ ...both, nameZh: undefined as never, nameEn: undefined as never }, 'en-US'),
    ).toBe('A:B');
  });
  it('treats a name that is not text as missing', () => {
    expect(nodeName({ ...both, nameZh: 42 as never, nameEn: { a: 1 } as never }, 'zh-CN')).toBe(
      'A:B',
    );
  });
});

describe('which nodes are built in and which can be chosen', () => {
  it('counts a node as built in unless the backend says it is not, and every code of the real list', () => {
    expect(isBuiltinNode(node('X', null, { builtin: true }))).toBe(true);
    expect(isBuiltinNode(node('X', null, { builtin: undefined as never }))).toBe(true);
    expect(isBuiltinNode(node('X', null, { builtin: false }))).toBe(false);
    expect(isBuiltinNode(node('USER:VIEW', null, { builtin: false }))).toBe(true);
  });

  it('lets a code of the real permission list be chosen, a custom node too, but not a built-in one the list lacks', () => {
    expect(isSelectable(node('USER:VIEW', null, { builtin: true }))).toBe(true);
    expect(isSelectable(node('CUSTOM:A', null, { builtin: false }))).toBe(true);
    expect(isSelectable(node('NEW:BUILTIN', null, { builtin: true }))).toBe(false);
    expect(isSelectable(node('NEW:BUILTIN', null, { builtin: undefined as never }))).toBe(false);
  });
});

describe('the tree as the page draws it', () => {
  it('puts the children under their parent in the order of sortOrder, then code, in the order of the roots', () => {
    const index = buildIndex([
      node('B', null, { sortOrder: 2 }),
      node('A', null, { sortOrder: 2 }),
      node('C', null, { sortOrder: 1 }),
      node('A2', 'A', { sortOrder: 2 }),
      node('A1', 'A', { sortOrder: 1 }),
    ]);
    expect(index.roots).toEqual(['C', 'A', 'B']);
    expect(index.childrenOf.get('A')).toEqual(['A1', 'A2']);
  });

  it('shows a node whose parent is not in the list as a root, and keeps the first of two nodes with one code', () => {
    const index = buildIndex([
      node('A', 'GONE'),
      node('B', 'A'),
      node('A', null, { nameEn: 'again' }),
    ]);
    expect(index.roots).toEqual(['A']);
    expect(index.childrenOf.get('A')).toEqual(['B']);
    expect(index.byCode.get('A')?.nameEn).toBe('A-en');
  });

  it('does not loop on a list that has a cycle or a node under itself: every member becomes a root', () => {
    const index = buildIndex([node('A', 'B'), node('B', 'A'), node('C', 'C'), node('D', 'A')]);
    expect(new Set(index.roots)).toEqual(new Set(['A', 'B', 'C']));
    expect(index.codes.sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(index.childrenOf.get('A')).toEqual(['D']);
  });
});

describe('choosing nodes of the permission tree', () => {
  const tree = [
    node('USER:VIEW', null, { builtin: true, sortOrder: 1 }),
    node('USER:BAN', 'USER:VIEW', { builtin: true, sortOrder: 2 }),
    node('USER:EXPORT', 'USER:VIEW', { builtin: true, sortOrder: 3 }),
    node('STATS:VIEW', null, { builtin: true, sortOrder: 4 }),
    node('STATS:EXPORT', 'STATS:VIEW', { builtin: true, sortOrder: 5 }),
    node('CUSTOM:G', null, { sortOrder: 6 }),
    node('CUSTOM:G1', 'CUSTOM:G', { sortOrder: 7 }),
    node('CUSTOM:G1X', 'CUSTOM:G1', { sortOrder: 8 }),
  ];
  const state = (value: string[], code: string) => stateOf(tree, value, code);

  it('checks the parent and every descendant together', () => {
    expect(toggleCode(tree, [], 'USER:VIEW')).toEqual(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
    expect(toggleCode(tree, [], 'CUSTOM:G')).toEqual(['CUSTOM:G', 'CUSTOM:G1', 'CUSTOM:G1X']);
  });

  it('takes one descendant away: the parent goes out of the value and shows half checked', () => {
    const all = toggleCode(tree, [], 'USER:VIEW');
    const less = toggleCode(tree, all, 'USER:BAN');
    expect(less).toEqual(['USER:EXPORT']);
    expect(state(less, 'USER:VIEW')).toBe('half');
    expect(state(less, 'USER:BAN')).toBe('none');
    expect(state(less, 'USER:EXPORT')).toBe('checked');
  });

  it('checks the parent when the last missing descendant is checked, all the way up', () => {
    expect(toggleCode(tree, ['USER:BAN'], 'USER:EXPORT')).toEqual([
      'USER:BAN',
      'USER:EXPORT',
      'USER:VIEW',
    ]);
    expect(toggleCode(tree, ['CUSTOM:G1'], 'CUSTOM:G1X')).toEqual([
      'CUSTOM:G',
      'CUSTOM:G1',
      'CUSTOM:G1X',
    ]);
    expect(toggleCode(tree, [], 'USER:BAN')).toEqual(['USER:BAN']);
    expect(state(['USER:BAN'], 'USER:VIEW')).toBe('half');
  });

  it('unchecking a parent clears every descendant, and unchecking a deep node clears the nodes above it', () => {
    expect(
      toggleCode(tree, ['USER:BAN', 'USER:EXPORT', 'USER:VIEW', 'STATS:VIEW'], 'USER:VIEW'),
    ).toEqual(['STATS:VIEW']);
    const all = toggleCode(tree, [], 'CUSTOM:G');
    expect(toggleCode(tree, all, 'CUSTOM:G1X')).toEqual([]);
  });

  it('clicking a half checked parent checks it with everything below', () => {
    expect(toggleCode(tree, ['USER:BAN'], 'USER:VIEW')).toEqual([
      'USER:BAN',
      'USER:EXPORT',
      'USER:VIEW',
    ]);
  });

  it('shows exactly what the role holds: a parent alone is checked and its children are not', () => {
    expect(state(['USER:VIEW'], 'USER:VIEW')).toBe('checked');
    expect(state(['USER:VIEW'], 'USER:BAN')).toBe('none');
  });

  it('gives the complete list, sorted, without a code twice or a code that is not in the tree or cannot be chosen', () => {
    const out = toggleCode(
      [...tree, node('NEW:BUILTIN', null, { builtin: true })],
      ['STATS:VIEW', 'STATS:VIEW', 'GONE:CODE', 'NEW:BUILTIN'],
      'USER:BAN',
    );
    expect(out).toEqual(['STATS:VIEW', 'USER:BAN']);
  });

  it('ignores a click on a node that cannot be chosen or is not there', () => {
    const list = [...tree, node('NEW:BUILTIN', null, { builtin: true })];
    expect(toggleCode(list, ['STATS:VIEW'], 'NEW:BUILTIN')).toEqual(['STATS:VIEW']);
    expect(toggleCode(list, ['STATS:VIEW'], 'NOPE')).toEqual(['STATS:VIEW']);
  });

  it('does not choose a node that cannot be chosen when its parent is checked', () => {
    const list = [
      node('USER:VIEW', null, { builtin: true }),
      node('NEW:BUILTIN', 'USER:VIEW', { builtin: true }),
      node('USER:BAN', 'USER:VIEW', { builtin: true }),
    ];
    expect(toggleCode(list, [], 'USER:VIEW')).toEqual(['USER:BAN', 'USER:VIEW']);
    // the parent counts as complete although a child cannot be chosen
    expect(toggleCode(list, [], 'USER:BAN')).toEqual(['USER:BAN', 'USER:VIEW']);
  });

  it('does not change the list it is given', () => {
    const value = ['USER:BAN'];
    toggleCode(tree, value, 'USER:EXPORT');
    expect(value).toEqual(['USER:BAN']);
  });
});

describe('the same rules against a reference, on random trees and random clicks', () => {
  it('agrees with the reference on the value and on the state of every node, for 400 trees and 12 clicks each', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const rand = random(seed);
      const nodes = randomForest(rand);
      const roots = nest(nodes);
      const selectable = new Set(
        roots
          .flatMap(flatten)
          .filter((n) => n.selectable)
          .map((n) => n.code),
      );
      // start from any set of the codes of the tree, also one that no clicks could have made
      let reference = new Set(
        nodes.map((n) => n.code).filter((c) => selectable.has(c) && rand() < 0.4),
      );
      let value = [...reference].sort();
      for (let step = 0; step < 12; step += 1) {
        const code = pick(rand, nodes).code;
        reference = refToggle(roots, reference, code);
        value = toggleCode(nodes, value, code);
        const label = `seed ${seed} step ${step} click ${code}`;
        expect(value, label).toEqual([...reference].sort());
        for (const n of nodes) {
          expect(stateOf(nodes, value, n.code), `${label} state ${n.code}`).toBe(
            refState(roots, reference, n.code),
          );
        }
      }
    }
  });

  it('keeps the rules that do not depend on the reference: what a click may change and what it must do', () => {
    for (let seed = 1000; seed <= 1400; seed += 1) {
      const rand = random(seed);
      const nodes = randomForest(rand);
      const roots = nest(nodes);
      const flat = roots.flatMap(flatten);
      const selectable = new Set(flat.filter((n) => n.selectable).map((n) => n.code));
      const before = nodes.map((n) => n.code).filter((c) => selectable.has(c) && rand() < 0.4);
      const click = pick(rand, nodes);
      const path = pathTo(roots, click.code) as RefNode[];
      const below = new Set(flatten(path[path.length - 1]).map((n) => n.code));
      const above = new Set(path.slice(0, -1).map((n) => n.code));
      const after = toggleCode(nodes, before, click.code);
      const label = `seed ${seed} click ${click.code}`;
      // only chosen codes, once each, in order
      expect(after, label).toEqual([...new Set(after)].sort());
      for (const code of after) expect(selectable.has(code), `${label} ${code}`).toBe(true);
      // nothing outside the node, its descendants and its ancestors changes
      const changed = [...new Set([...before, ...after])].filter(
        (c) => before.includes(c) !== after.includes(c),
      );
      for (const code of changed)
        expect(below.has(code) || above.has(code), `${label} changed ${code}`).toBe(true);
      if (!selectable.has(click.code)) {
        expect(after, label).toEqual([...before].sort());
      } else if (before.includes(click.code)) {
        for (const code of [...below, ...above])
          expect(after.includes(code), `${label} off ${code}`).toBe(false);
      } else {
        for (const code of below) {
          if (selectable.has(code)) expect(after.includes(code), `${label} on ${code}`).toBe(true);
        }
        for (const code of above) {
          // only additions above
          expect(before.includes(code) && !after.includes(code), `${label} lost ${code}`).toBe(
            false,
          );
        }
      }
      // a click on a chosen node and a second click on it: the node and everything below it ends up off
      const second = toggleCode(nodes, after, click.code);
      if (selectable.has(click.code)) {
        const wasOn = after.includes(click.code);
        expect(second.includes(click.code), `${label} second`).toBe(!wasOn);
      }
    }
  });
});

describe('the parent of a custom node', () => {
  const nodes = [
    node('R', null),
    node('A', 'R'),
    node('B', 'A'),
    node('C', 'B'),
    node('D', 'R'),
    node('USER:VIEW', null, { builtin: true }),
  ];

  it('is never the node itself or anything below it', () => {
    expect(parentCandidates(nodes, 'A').sort()).toEqual(['D', 'R', 'USER:VIEW']);
    expect(parentCandidates(nodes, 'C').sort()).toEqual(['A', 'B', 'D', 'R', 'USER:VIEW']);
    expect(parentCandidates(nodes, 'R').sort()).toEqual(['USER:VIEW']);
  });

  it('knows that moving a node under itself or a descendant makes a loop', () => {
    expect(wouldCreateCycle(nodes, 'A', 'A')).toBe(true);
    expect(wouldCreateCycle(nodes, 'A', 'B')).toBe(true);
    expect(wouldCreateCycle(nodes, 'A', 'C')).toBe(true);
    expect(wouldCreateCycle(nodes, 'A', 'D')).toBe(false);
    expect(wouldCreateCycle(nodes, 'A', null)).toBe(false);
    expect(wouldCreateCycle(nodes, 'A', 'R')).toBe(false);
  });

  it('holds on random trees: a candidate never makes a loop, and every other node would', () => {
    for (let seed = 2000; seed <= 2200; seed += 1) {
      const rand = random(seed);
      const list = randomForest(rand);
      const target = pick(rand, list).code;
      const roots = nest(list);
      const path = pathTo(roots, target) as RefNode[];
      const below = new Set(flatten(path[path.length - 1]).map((n) => n.code));
      const candidates = new Set(parentCandidates(list, target));
      for (const n of list) {
        expect(candidates.has(n.code), `seed ${seed} ${n.code}`).toBe(!below.has(n.code));
        expect(wouldCreateCycle(list, target, n.code), `seed ${seed} ${n.code}`).toBe(
          below.has(n.code),
        );
      }
    }
  });
});
