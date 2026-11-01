import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import type { PermissionNode } from '../../services/system';
import {
  buildIndex,
  codesNotHeld,
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

/**
 * A random forest: every node has a parent among the nodes before it, or none. A node can be chosen
 * when its code is in the real permission list; a tenth are custom nodes and a tenth are built-in
 * nodes the list lacks, and neither can be chosen.
 */
function randomForest(rand: () => number): PermissionNode[] {
  const size = 1 + Math.floor(rand() * 24);
  const nodes: PermissionNode[] = [];
  for (let i = 0; i < size; i += 1) {
    const parent = i === 0 || rand() < 0.25 ? null : nodes[Math.floor(rand() * i)].code;
    const kind = rand();
    const code = kind < 0.1 ? `CUSTOM:${i}` : kind < 0.2 ? `NEW:${i}` : PERMISSION_CODES[i];
    nodes.push(node(code, parent, { builtin: kind >= 0.1, sortOrder: Math.floor(rand() * 5) }));
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
    selectable: (PERMISSION_CODES as readonly string[]).includes(n.code) || n.builtin !== false,
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
  } else {
    for (const n of flatten(target)) if (n.selectable) out.add(n.code);
    // every page above it that may be chosen: a function cannot be used without the page it is on
    for (let i = path.length - 2; i >= 0; i -= 1) if (path[i].selectable) out.add(path[i].code);
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

  it('lets the system nodes be chosen, also a built-in one the application does not know yet, and not a custom node', () => {
    expect(isSelectable(node('USER:VIEW', null, { builtin: true }))).toBe(true);
    // a real code stays a system node whatever the backend says about it
    expect(isSelectable(node('USER:VIEW', null, { builtin: false }))).toBe(true);
    expect(isSelectable(node('CUSTOM:A', null, { builtin: false }))).toBe(false);
    expect(isSelectable(node('NEW:BUILTIN', null, { builtin: true }))).toBe(true);
    expect(isSelectable(node('NEW:BUILTIN', null, { builtin: undefined as never }))).toBe(true);
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

  it('leaves out a node that has no code that is text, and a row that is not a node, and keeps the others', () => {
    const list = [
      {
        code: 'A',
        parent: null,
        type: 'MENU',
        sortOrder: 1,
        nameZh: 'A',
        nameEn: 'A',
        builtin: true,
      },
      { parent: null, type: 'MENU', sortOrder: 2 },
      { code: 12, parent: null, type: 'MENU', sortOrder: 3 },
      { code: '', parent: null, type: 'MENU', sortOrder: 4 },
      null,
      { code: 'B', parent: 'A', type: 'FUNCTION', sortOrder: 5, builtin: true },
    ] as never;
    const index = buildIndex(list);
    expect(index.codes).toEqual(['A', 'B']);
    expect(index.roots).toEqual(['A']);
    expect(index.childrenOf.get('A')).toEqual(['B']);
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
    node('SMS:RECORD', null, { builtin: true, sortOrder: 6 }),
    node('SMS:RECORD:EXPORT', 'SMS:RECORD', { builtin: true, sortOrder: 7 }),
    node('SMS:RECORD:PHONE_VIEW', 'SMS:RECORD:EXPORT', { builtin: true, sortOrder: 8 }),
    node('CUSTOM:G', null, { sortOrder: 9 }),
    node('CUSTOM:G1', 'CUSTOM:G', { sortOrder: 10 }),
  ];
  const state = (value: string[], code: string) => stateOf(tree, value, code);

  it('checks the parent and every descendant together', () => {
    expect(toggleCode(tree, [], 'USER:VIEW')).toEqual(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
    expect(toggleCode(tree, [], 'SMS:RECORD')).toEqual([
      'SMS:RECORD',
      'SMS:RECORD:EXPORT',
      'SMS:RECORD:PHONE_VIEW',
    ]);
  });

  it('never checks a custom node, not by a click on it and not through its parent', () => {
    expect(toggleCode(tree, [], 'CUSTOM:G')).toEqual([]);
    expect(toggleCode(tree, ['STATS:VIEW'], 'CUSTOM:G1')).toEqual(['STATS:VIEW']);
    const mixed = [
      node('USER:VIEW', null, { builtin: true }),
      node('CUSTOM:UNDER', 'USER:VIEW'),
      node('USER:BAN', 'USER:VIEW', { builtin: true }),
    ];
    expect(toggleCode(mixed, [], 'USER:VIEW')).toEqual(['USER:BAN', 'USER:VIEW']);
    // a custom code in the value is dropped
    expect(toggleCode(mixed, ['CUSTOM:UNDER'], 'USER:BAN')).toEqual(['USER:BAN', 'USER:VIEW']);
    expect(toggleCode(mixed, ['CUSTOM:UNDER', 'STATS:VIEW'], 'STATS:VIEW')).toEqual([]);
  });

  it('takes one descendant away: the parent keeps its code, so the role holds the page and a part of its functions', () => {
    const all = toggleCode(tree, [], 'USER:VIEW');
    const less = toggleCode(tree, all, 'USER:BAN');
    expect(less).toEqual(['USER:EXPORT', 'USER:VIEW']);
    expect(state(less, 'USER:VIEW')).toBe('checked');
    expect(state(less, 'USER:BAN')).toBe('none');
    expect(state(less, 'USER:EXPORT')).toBe('checked');
  });

  it('keeps the page code of a role that holds the page and one function when that function is taken away', () => {
    // the role "customer service": the page code and one function code
    expect(toggleCode(tree, ['USER:BAN', 'USER:VIEW'], 'USER:BAN')).toEqual(['USER:VIEW']);
    // taking away every function leaves the page alone
    expect(toggleCode(tree, ['USER:VIEW', 'USER:EXPORT'], 'USER:EXPORT')).toEqual(['USER:VIEW']);
  });

  it('keeps every node above when a deep node is taken away', () => {
    const all = toggleCode(tree, [], 'SMS:RECORD');
    expect(toggleCode(tree, all, 'SMS:RECORD:PHONE_VIEW')).toEqual([
      'SMS:RECORD',
      'SMS:RECORD:EXPORT',
    ]);
    expect(toggleCode(tree, all, 'SMS:RECORD:EXPORT')).toEqual(['SMS:RECORD']);
  });

  it('can make a role of the page alone, and of the page with any part of its functions', () => {
    // every set of the codes of the page USER:VIEW that has the page code is reachable by clicks
    const seen = new Set<string>(['']);
    const queue: string[][] = [[]];
    while (queue.length > 0) {
      const value = queue.shift() as string[];
      for (const code of ['USER:VIEW', 'USER:BAN', 'USER:EXPORT']) {
        const next = toggleCode(tree, value, code);
        if (!seen.has(next.join('|'))) {
          seen.add(next.join('|'));
          queue.push(next);
        }
      }
    }
    for (const wanted of [
      ['USER:VIEW'],
      ['USER:BAN', 'USER:VIEW'],
      ['USER:EXPORT', 'USER:VIEW'],
      ['USER:BAN', 'USER:EXPORT', 'USER:VIEW'],
    ]) {
      expect(seen.has(wanted.join('|')), wanted.join(',')).toBe(true);
    }
  });

  it('checking a function checks every page above it, all the way up, and nothing else', () => {
    expect(toggleCode(tree, [], 'USER:BAN')).toEqual(['USER:BAN', 'USER:VIEW']);
    expect(toggleCode(tree, ['USER:BAN'], 'USER:EXPORT')).toEqual([
      'USER:BAN',
      'USER:EXPORT',
      'USER:VIEW',
    ]);
    // the middle node and the page above it, not the sibling below the page
    expect(toggleCode(tree, [], 'SMS:RECORD:PHONE_VIEW')).toEqual([
      'SMS:RECORD',
      'SMS:RECORD:EXPORT',
      'SMS:RECORD:PHONE_VIEW',
    ]);
    expect(toggleCode(tree, [], 'SMS:RECORD:EXPORT')).toEqual([
      'SMS:RECORD',
      'SMS:RECORD:EXPORT',
      'SMS:RECORD:PHONE_VIEW',
    ]);
    // a page that is already there stays, and the other pages are not touched
    expect(toggleCode(tree, ['STATS:VIEW'], 'USER:BAN')).toEqual([
      'STATS:VIEW',
      'USER:BAN',
      'USER:VIEW',
    ]);
    // the page is checked and its other functions are not
    expect(state(toggleCode(tree, [], 'USER:BAN'), 'USER:EXPORT')).toBe('none');
  });

  it('checking a function of a role that has the functions but lost the page (an old role) puts the page back', () => {
    expect(toggleCode(tree, ['USER:BAN'], 'USER:EXPORT')).toContain('USER:VIEW');
    expect(toggleCode(tree, ['STATS:EXPORT'], 'USER:BAN')).toEqual([
      'STATS:EXPORT',
      'USER:BAN',
      'USER:VIEW',
    ]);
  });

  it('skips a node above that cannot be chosen, and goes on to the ones above that', () => {
    const list = [
      node('STATS:VIEW', null, { builtin: true }),
      node('CUSTOM:GROUP', 'STATS:VIEW'),
      node('USER:BAN', 'CUSTOM:GROUP', { builtin: true }),
      node('CUSTOM:SECOND', 'STATS:VIEW'),
      node('USER:EXPORT', 'CUSTOM:SECOND', { builtin: true }),
    ];
    expect(toggleCode(list, [], 'USER:BAN')).toEqual(['STATS:VIEW', 'USER:BAN']);
    expect(toggleCode(list, [], 'USER:EXPORT')).toEqual(['STATS:VIEW', 'USER:EXPORT']);
  });

  it('taking a function away after it was checked leaves the page, and the page alone can then be taken away', () => {
    const one = toggleCode(tree, [], 'USER:BAN');
    expect(toggleCode(tree, one, 'USER:BAN')).toEqual(['USER:VIEW']);
    expect(toggleCode(tree, ['USER:VIEW'], 'USER:VIEW')).toEqual([]);
  });

  it('unchecking a parent clears the parent and every descendant, and nothing else', () => {
    expect(
      toggleCode(tree, ['USER:BAN', 'USER:EXPORT', 'USER:VIEW', 'STATS:VIEW'], 'USER:VIEW'),
    ).toEqual(['STATS:VIEW']);
    // a node in the middle goes with what is below it; the node above it stays
    expect(
      toggleCode(
        tree,
        ['SMS:RECORD', 'SMS:RECORD:EXPORT', 'SMS:RECORD:PHONE_VIEW'],
        'SMS:RECORD:EXPORT',
      ),
    ).toEqual(['SMS:RECORD']);
    // the page itself is taken away by unchecking the page
    expect(toggleCode(tree, ['SMS:RECORD'], 'SMS:RECORD')).toEqual([]);
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
      [...tree, node('CUSTOM:X', null)],
      ['STATS:VIEW', 'STATS:VIEW', 'GONE:CODE', 'CUSTOM:X'],
      'USER:BAN',
    );
    expect(out).toEqual(['STATS:VIEW', 'USER:BAN', 'USER:VIEW']);
  });

  it('ignores a click on a node that cannot be chosen or is not there', () => {
    const list = [...tree, node('CUSTOM:X', null)];
    expect(toggleCode(list, ['STATS:VIEW'], 'CUSTOM:X')).toEqual(['STATS:VIEW']);
    expect(toggleCode(list, ['STATS:VIEW'], 'NOPE')).toEqual(['STATS:VIEW']);
  });

  it('does not choose a node that cannot be chosen when its parent is checked', () => {
    const list = [
      node('USER:VIEW', null, { builtin: true }),
      node('CUSTOM:SIBLING', 'USER:VIEW'),
      node('USER:BAN', 'USER:VIEW', { builtin: true }),
    ];
    expect(toggleCode(list, [], 'USER:VIEW')).toEqual(['USER:BAN', 'USER:VIEW']);
    // the page above is checked although a sibling cannot be chosen
    expect(toggleCode(list, [], 'USER:BAN')).toEqual(['USER:BAN', 'USER:VIEW']);
  });

  it('chooses and keeps a built-in node the application does not know yet, like any system node', () => {
    const list = [
      node('USER:VIEW', null, { builtin: true }),
      node('NEW:BUILTIN', 'USER:VIEW', { builtin: true }),
    ];
    expect(toggleCode(list, [], 'USER:VIEW')).toEqual(['NEW:BUILTIN', 'USER:VIEW']);
    expect(toggleCode(list, ['NEW:BUILTIN'], 'NEW:BUILTIN')).toEqual([]);
    expect(toggleCode(list, ['NEW:BUILTIN', 'USER:VIEW'], 'USER:VIEW')).toEqual([]);
    expect(stateOf(list, ['NEW:BUILTIN'], 'NEW:BUILTIN')).toBe('checked');
  });

  it('does not change the list it is given', () => {
    const value = ['USER:BAN'];
    toggleCode(tree, value, 'USER:EXPORT');
    expect(value).toEqual(['USER:BAN']);
  });
});

describe('choosing nodes as an administrator who holds only some of the codes', () => {
  const tree = [
    node('USER:VIEW', null, { builtin: true, sortOrder: 1 }),
    node('USER:BAN', 'USER:VIEW', { builtin: true, sortOrder: 2 }),
    node('USER:EXPORT', 'USER:VIEW', { builtin: true, sortOrder: 3 }),
    node('STATS:VIEW', null, { builtin: true, sortOrder: 4 }),
  ];
  const held = (...codes: string[]) => new Set(codes);

  it('does not change anything on a click on a node that is not held, checked or not', () => {
    const grantable = held('USER:VIEW', 'USER:BAN');
    expect(toggleCode(tree, [], 'USER:EXPORT', grantable)).toEqual([]);
    expect(toggleCode(tree, ['USER:BAN', 'USER:VIEW'], 'USER:EXPORT', grantable)).toEqual([
      'USER:BAN',
      'USER:VIEW',
    ]);
    expect(
      toggleCode(tree, ['USER:BAN', 'USER:EXPORT', 'USER:VIEW'], 'USER:EXPORT', grantable),
    ).toEqual(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
    expect(toggleCode(tree, [], 'STATS:VIEW', grantable)).toEqual([]);
  });

  it('checks a function without the page above it when the page is not held: a code that is not held is never added', () => {
    expect(toggleCode(tree, [], 'USER:BAN', held('USER:BAN'))).toEqual(['USER:BAN']);
    // the page above is not held and cannot be clicked either
    expect(toggleCode(tree, [], 'USER:VIEW', held('USER:BAN'))).toEqual([]);
    expect(toggleCode(tree, ['USER:BAN'], 'USER:VIEW', held('USER:BAN'))).toEqual(['USER:BAN']);
  });

  it('checks a function and the page above it when both are held', () => {
    expect(toggleCode(tree, [], 'USER:BAN', held('USER:VIEW', 'USER:BAN'))).toEqual([
      'USER:BAN',
      'USER:VIEW',
    ]);
  });

  it('checks a page with the functions below it that are held, and not the others', () => {
    expect(toggleCode(tree, [], 'USER:VIEW', held('USER:VIEW', 'USER:BAN'))).toEqual([
      'USER:BAN',
      'USER:VIEW',
    ]);
    expect(toggleCode(tree, [], 'USER:VIEW', held('USER:VIEW'))).toEqual(['USER:VIEW']);
  });

  it('takes away only the held nodes below a node that is unchecked, and keeps the codes that are not held', () => {
    const grantable = held('USER:VIEW', 'USER:BAN');
    const role = ['USER:BAN', 'USER:EXPORT', 'USER:VIEW'];
    expect(toggleCode(tree, role, 'USER:VIEW', grantable)).toEqual(['USER:EXPORT']);
    // taking a function away keeps the page
    expect(toggleCode(tree, ['USER:BAN', 'USER:VIEW'], 'USER:BAN', grantable)).toEqual([
      'USER:VIEW',
    ]);
  });

  it('changes nothing for an administrator who holds nothing', () => {
    expect(toggleCode(tree, ['STATS:VIEW'], 'STATS:VIEW', held())).toEqual(['STATS:VIEW']);
    expect(toggleCode(tree, [], 'USER:VIEW', held())).toEqual([]);
  });

  it('is the same as no limit when the set is missing or null', () => {
    expect(toggleCode(tree, [], 'USER:EXPORT', null)).toEqual(['USER:EXPORT', 'USER:VIEW']);
    expect(toggleCode(tree, [], 'USER:EXPORT', undefined)).toEqual(['USER:EXPORT', 'USER:VIEW']);
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
        for (const code of below) expect(after.includes(code), `${label} off ${code}`).toBe(false);
        // the nodes above keep what they had
        for (const code of above)
          expect(after.includes(code), `${label} kept ${code}`).toBe(before.includes(code));
      } else {
        for (const code of below) {
          if (selectable.has(code)) expect(after.includes(code), `${label} on ${code}`).toBe(true);
        }
        for (const code of above) {
          // only additions above, and every node above that may be chosen is there now
          expect(before.includes(code) && !after.includes(code), `${label} lost ${code}`).toBe(
            false,
          );
          if (selectable.has(code))
            expect(after.includes(code), `${label} page ${code}`).toBe(true);
          else expect(after.includes(code), `${label} not choosable ${code}`).toBe(false);
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

describe('the codes of a role that the administrator does not hold', () => {
  const held = new Set(['USER:VIEW', 'USER:BAN']);

  it('lists the codes that are not held, once each, in the order of the role', () => {
    expect(
      codesNotHeld(['USER:VIEW', 'USER:EXPORT', 'COST:VIEW', 'USER:EXPORT', 'USER:BAN'], held),
    ).toEqual(['USER:EXPORT', 'COST:VIEW']);
  });

  it('is empty when every code is held, when the role has none, and for a super administrator (no set)', () => {
    expect(codesNotHeld(['USER:BAN', 'USER:VIEW'], held)).toEqual([]);
    expect(codesNotHeld([], held)).toEqual([]);
    expect(codesNotHeld(['COST:VIEW'], null)).toEqual([]);
  });

  it('counts everything against an empty set, also codes the tree does not know', () => {
    expect(codesNotHeld(['USER:VIEW', 'OLD:THING'], new Set())).toEqual(['USER:VIEW', 'OLD:THING']);
  });

  it('writes a value that is not text out as plain text and leaves out what is nothing', () => {
    expect(codesNotHeld([42, { a: 1 }, null, undefined, '', 'ผู้ใช้:ดู', 'USER:VIEW'], held)).toEqual([
      '42',
      '{"a":1}',
      'ผู้ใช้:ดู',
    ]);
  });

  it('compares the exact code: case and spaces count', () => {
    expect(codesNotHeld(['user:view', ' USER:VIEW'], held)).toEqual(['user:view', ' USER:VIEW']);
  });
});
