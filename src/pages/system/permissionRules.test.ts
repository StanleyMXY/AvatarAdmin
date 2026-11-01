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
  it('trims the names and sends the parent of a custom node only when it changed', () => {
    expect(buildPermissionPatch(nodes, nodes[0], { ...values, parent: null })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3 },
    });
    expect(buildPermissionPatch(nodes, nodes[0], { ...values, parent: 'D' })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3, parent: 'D' },
    });
    // the first parent of a node under a parent can become none
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

  it('never moves a built-in node', () => {
    expect(buildPermissionPatch(nodes, nodes[4], { ...values, parent: null })).toEqual({
      ok: true,
      patch: { nameZh: '名', nameEn: 'name', sortOrder: 3 },
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
  it('is required, has no white space or control characters inside, is not too long and is not taken', () => {
    expect(codeProblem('', nodes)).toBe('required');
    expect(codeProblem('   ', nodes)).toBe('required');
    expect(codeProblem('CUSTOM:NEW', nodes)).toBeNull();
    expect(codeProblem('  CUSTOM:NEW  ', nodes)).toBeNull();
    expect(codeProblem('has space', nodes)).toBe('invalid');
    expect(codeProblem(`tab${String.fromCharCode(9)}x`, nodes)).toBe('invalid');
    expect(codeProblem(`nbsp${String.fromCharCode(0xa0)}x`, nodes)).toBe('invalid');
    expect(codeProblem(`bidi${String.fromCharCode(0x202e)}x`, nodes)).toBe('invalid');
    expect(codeProblem('x'.repeat(101), nodes)).toBe('invalid');
    expect(codeProblem('x'.repeat(100), nodes)).toBeNull();
    expect(codeProblem('A', nodes)).toBe('taken');
    expect(codeProblem(' USER:VIEW ', nodes)).toBe('taken');
  });

  // The code is also a path segment of the edit and delete requests: `.` and `..` are read as the
  // current and the parent directory there, so a node with such a code could never be reached again.
  it.each([
    '.',
    '..',
    '...',
    ' . ',
    ' .. ',
    '.hidden',
    'trailing.',
    'USER:VIEW.',
    'a..',
    '..a',
    '.ผู้ใช้',
    'نص.',
  ])('refuses %j: a code does not start or end with a dot', (code) => {
    expect(codeProblem(code, nodes)).toBe('dots');
  });

  it.each([
    'a.b',
    'a..b',
    'USER.VIEW',
    'custom.report:view',
    'ผู้ใช้.ดู',
    'usuario.ver',
    'pengguna.lihat',
    'người.dùng',
    'مستخدم.عرض',
    '用户.查看',
    'v1.2.3',
  ])('allows %j: a dot inside the code is fine', (code) => {
    expect(codeProblem(code, nodes)).toBeNull();
  });

  it('names the character problem before the dot problem, and the dot problem before "taken"', () => {
    expect(codeProblem('. x', nodes)).toBe('invalid');
    expect(codeProblem('x .', nodes)).toBe('invalid');
    expect(codeProblem('.'.repeat(101), nodes)).toBe('invalid');
    const withDots = [...nodes, node('.dotted', null)];
    expect(codeProblem('.dotted', withDots)).toBe('dots');
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
