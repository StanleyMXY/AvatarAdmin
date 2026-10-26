import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { permissionTreeFromSpec } from '../../scripts/permissionTree';
import { PERMISSION_CODES } from '../../src/access/permissionCodes';
import enNames from '../../src/locales/en-US/permission';
import zhNames from '../../src/locales/zh-CN/permission';
import { ALL_CODES, PRESET_PERMISSIONS, permissionNodes } from './permissions';
import tree from './permissionTree.generated.json';

describe('permissionNodes', () => {
  const nodes = permissionNodes();

  it('has one node for every permission code', () => {
    expect(nodes).toHaveLength(PERMISSION_CODES.length);
    expect(nodes.map((n) => n.code).sort()).toEqual([...PERMISSION_CODES].sort());
  });

  it('gives every FUNCTION node a parent that exists and is a MENU node', () => {
    const byCode = new Map(nodes.map((n) => [n.code, n]));
    const functions = nodes.filter((n) => n.type === 'FUNCTION');
    expect(functions.length).toBeGreaterThan(0);
    for (const node of functions) {
      expect(byCode.get(node.parent ?? '')?.type).toBe('MENU');
    }
  });

  it('gives MENU nodes no parent, and every node a unique sort order', () => {
    for (const node of nodes.filter((n) => n.type === 'MENU')) expect(node.parent).toBeNull();
    expect(new Set(nodes.map((n) => n.sortOrder)).size).toBe(nodes.length);
  });

  it('names every node in both languages from the language files, and marks it built in', () => {
    for (const node of nodes) {
      expect(node.nameZh).toBe(zhNames[`permission.${node.code}`]);
      expect(node.nameEn).toBe(enNames[`permission.${node.code}`]);
      expect(node.builtin).toBe(true);
      expect(node.createdByUsername).toBeNull();
    }
  });

  it('puts a code under the page it belongs to', () => {
    const parentOf = (code: string) => nodes.find((n) => n.code === code)?.parent;
    expect(parentOf('USER:BAN')).toBe('USER:VIEW');
    expect(parentOf('SMS:RECORD:EXPORT')).toBe('SMS:RECORD');
    expect(parentOf('CREDIT:REVIEW')).toBe('SUBSCRIPTION:VIEW');
    expect(parentOf('MEMORY:MODEL_ASSIGN')).toBe('MEMORY:VIEW');
  });
});

describe('the committed tree data', () => {
  it('equals what the spec snapshot derives, so the data cannot drift from the spec', () => {
    const spec = readFileSync('docs/shared-snapshots/admin-frontend-design.md', 'utf8');
    expect(tree).toEqual(permissionTreeFromSpec(spec, PERMISSION_CODES));
  });
});

describe('preset permissions', () => {
  it('only name real permission codes', () => {
    for (const codes of Object.values(PRESET_PERMISSIONS)) {
      for (const code of codes) expect(ALL_CODES).toContain(code);
    }
  });
});
