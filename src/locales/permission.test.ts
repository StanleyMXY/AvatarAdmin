import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../access/permissionCodes';
import enPermission from './en-US/permission';
import zhPermission from './zh-CN/permission';

describe.each([
  ['zh-CN', zhPermission],
  ['en-US', enPermission],
] as const)('%s permission names', (_name, names) => {
  it.each(PERMISSION_CODES)('has a non-empty name for %s', (code) => {
    expect(names[`permission.${code}`]?.trim()).toBeTruthy();
  });

  it('has no name for a code that does not exist', () => {
    expect(Object.keys(names).sort()).toEqual(
      PERMISSION_CODES.map((c) => `permission.${c}`).sort(),
    );
  });

  it('does not use the code itself as its name', () => {
    for (const code of PERMISSION_CODES) expect(names[`permission.${code}`]).not.toBe(code);
  });
});

describe('the two languages', () => {
  it('differ for every code', () => {
    for (const code of PERMISSION_CODES) {
      expect(zhPermission[`permission.${code}`]).not.toBe(enPermission[`permission.${code}`]);
    }
  });

  it('give different names to different codes in the same language', () => {
    for (const names of [zhPermission, enPermission]) {
      const values = Object.values(names);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
