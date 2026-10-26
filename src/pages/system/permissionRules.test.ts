import { describe, expect, it } from 'vitest';
import type { PermissionNode } from '../../services/system';
import { buildPermissionPatch, codeProblem } from './permissionRules';

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
});
