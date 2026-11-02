import { describe, expect, it } from 'vitest';
import type { PermissionNode } from '../../services/system';
import { buildPermissionPatch, codeProblem, nextSortOrder } from './permissionRules';

const node = (code: string, parent: string | null, builtin = false): PermissionNode => ({
  code,
  parent,
  type: 'MENU',
  sortOrder: 1,
  nameZh: code,
  nameEn: code,
  builtin,
});
const nodes = [
  node('A', null),
  node('B', 'A'),
  node('C', 'B'),
  node('D', null),
  node('USER:VIEW', null, true),
];
const values = { nameZh: ' 名 ', nameEn: ' name ', sortOrder: 3 };

describe('the patch of a node that is edited', () => {
  it('trims the names and always carries the parent: the current one when the node is not moved (null for a root), the new one when it is (backend answer 87)', () => {
    // a root stays a root: parent null is in the request
    expect(buildPermissionPatch(nodes, nodes[0], { ...values, parent: null })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: null },
    });
    // a node under a parent keeps it when it is not moved
    expect(buildPermissionPatch(nodes, nodes[1], { ...values, parent: 'A' })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: 'A' },
    });
    expect(buildPermissionPatch(nodes, nodes[0], { ...values, parent: 'D' })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: 'D' },
    });
    // the parent of a node under a parent can become none
    expect(buildPermissionPatch(nodes, nodes[1], { ...values, parent: null })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: null },
    });
  });

  it('refuses a parent that is the node itself or one of its descendants', () => {
    for (const parent of ['A', 'B', 'C']) {
      expect(buildPermissionPatch(nodes, nodes[0], { ...values, parent })).toEqual({
        ok: false,
        reason: 'loop',
      });
    }
    expect(buildPermissionPatch(nodes, nodes[1], { ...values, parent: 'C' })).toEqual({
      ok: false,
      reason: 'loop',
    });
  });

  it('never moves a built-in node, and sends its own parent', () => {
    expect(buildPermissionPatch(nodes, nodes[4], { ...values, parent: null })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: null },
    });
    const withParent = [...nodes, node('USER:BAN', 'USER:VIEW', true)];
    expect(
      buildPermissionPatch(withParent, withParent[5], { ...values, parent: 'USER:VIEW' }),
    ).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: 'USER:VIEW' },
    });
    expect(buildPermissionPatch(nodes, nodes[4], { ...values, parent: 'D' })).toEqual({
      ok: false,
      reason: 'builtinParent',
    });
  });

  it('counts a node as built in when the backend does not say it is not', () => {
    const unknown = { ...node('X', null), builtin: undefined as never };
    expect(buildPermissionPatch([unknown, nodes[3]], unknown, { ...values, parent: 'D' })).toEqual({
      ok: false,
      reason: 'builtinParent',
    });
  });
});

describe('the code of a new node', () => {
  it('is required, 1 to 128 of ASCII letters, digits and _ : # / . - (case sensitive), and not taken', () => {
    expect(codeProblem('', nodes)).toBe('required');
    expect(codeProblem('   ', nodes)).toBe('required');
    expect(codeProblem('CUSTOM:NEW', nodes)).toBeNull();
    expect(codeProblem('  CUSTOM:NEW  ', nodes)).toBeNull();
    expect(codeProblem('a.b/c#d_e:f-g', nodes)).toBeNull();
    expect(codeProblem('MENU:/system/audit', nodes)).toBeNull();
    expect(codeProblem('x'.repeat(128), nodes)).toBeNull();
    expect(codeProblem('x'.repeat(129), nodes)).toBe('invalid');
    expect(codeProblem('A', nodes)).toBe('taken');
    // a code differs by case: another node
    expect(codeProblem('a', nodes)).toBeNull();
    expect(codeProblem(' USER:VIEW ', nodes)).toBe('taken');
  });

  it.each([
    'has space',
    `tab${String.fromCharCode(9)}x`,
    `nbsp${String.fromCharCode(0xa0)}x`,
    `bidi${String.fromCharCode(0x202e)}x`,
    `zero${String.fromCharCode(0x200b)}width`,
    'a,b',
    'a;b',
    'a%2Fb',
    'a\\b',
    'a?b',
    'a*b',
    'ผู้ใช้.ดู',
    'نص.عرض',
    '用户.查看',
    'José',
    'Nguyễn',
  ])('refuses %j: a character that is not in the set of the backend', (code) => {
    expect(codeProblem(code, nodes)).toBe('invalid');
  });

  // A dot anywhere is fine for the backend, at either end too (this replaces the earlier rule of the
  // page that a code does not start or end with a dot).
  it.each([
    '.hidden',
    'trailing.',
    'USER:VIEW.',
    'a..',
    '..a',
    'a.b',
    'a..b',
    'USER.VIEW',
    'custom.report:view',
    'v1.2.3',
  ])('allows %j: a dot is a character of the set, also at the ends', (code) => {
    expect(codeProblem(code, nodes)).toBeNull();
  });

  // The code is also a path segment of the edit and delete requests: `.` and `..` are read as the
  // current and the parent directory there, so a node with such a code could never be reached again.
  it.each(['.', '..', '...', ' . ', ' .. '])(
    'refuses %j: a code made only of dots (the page keeps this one back although the backend takes it)',
    (code) => {
      expect(codeProblem(code, nodes)).toBe('dots');
    },
  );

  it('names the character problem before the dots problem, and the dots problem before "taken"', () => {
    expect(codeProblem('. x', nodes)).toBe('invalid');
    expect(codeProblem('.'.repeat(129), nodes)).toBe('invalid');
    const withDots = [...nodes, node('..', null)];
    expect(codeProblem('..', withDots)).toBe('dots');
  });
});

describe('the order offered for a new node', () => {
  const at = (code: string, parent: string | null, sortOrder: unknown): PermissionNode => ({
    ...node(code, parent),
    sortOrder: sortOrder as number,
  });

  it('is one more than the last of the siblings under the same parent', () => {
    const list = [
      at('R1', null, 5),
      at('R2', null, 9),
      at('C1', 'R1', 40),
      at('C2', 'R1', 2),
      at('G1', 'C1', 100),
    ];
    expect(nextSortOrder(list, null)).toBe(10);
    expect(nextSortOrder(list, 'R1')).toBe(41);
    expect(nextSortOrder(list, 'C1')).toBe(101);
  });

  it('is 1 when there is no sibling, also for a parent that is not in the list or an empty tree', () => {
    expect(nextSortOrder([], null)).toBe(1);
    expect(nextSortOrder([at('R1', null, 5)], 'R1')).toBe(1);
    expect(nextSortOrder([at('R1', null, 5)], 'GONE')).toBe(1);
  });

  it('counts a node whose parent is not in the list as a root, as the tree draws it', () => {
    expect(nextSortOrder([at('LOST', 'GONE', 30), at('R1', null, 5)], null)).toBe(31);
  });

  it('works with negative orders and ignores an order that is not a number', () => {
    expect(nextSortOrder([at('A', null, -7), at('B', null, -3)], null)).toBe(-2);
    expect(nextSortOrder([at('A', null, 'x'), at('B', null, null), at('C', null, 4)], null)).toBe(
      5,
    );
    expect(nextSortOrder([at('A', null, 'x')], null)).toBe(1);
    expect(nextSortOrder([at('A', null, Number.NaN)], null)).toBe(1);
  });

  it('stays a safe integer', () => {
    const top = Number.MAX_SAFE_INTEGER;
    expect(Number.isSafeInteger(nextSortOrder([at('A', null, top)], null))).toBe(true);
  });
});
