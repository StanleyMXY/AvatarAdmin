import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  for (const name of [
    'ADMIN_PRODUCT_NAME',
    'ADMIN_LOGO_URL',
    'ADMIN_PRIMARY_COLOR',
    'ADMIN_PRIMARY_HOVER',
    'ADMIN_PRIMARY_ACTIVE',
    'ADMIN_QUALITY_MIN_SUCCESS_RATE',
    'ADMIN_QUALITY_MAX_SLOW_SHARE',
  ]) {
    vi.stubEnv(name, undefined as never);
  }
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  return import('./buildVars');
};

afterEach(() => vi.unstubAllEnvs());

describe('buildVars', () => {
  it('has the defaults of the spec', async () => {
    const { buildVars } = await load();
    expect(buildVars).toEqual({
      ADMIN_PRODUCT_NAME: 'Admin',
      ADMIN_LOGO_URL: '/logo.svg',
      ADMIN_PRIMARY_COLOR: '#0ABAB5',
      ADMIN_PRIMARY_HOVER: '#3DCBC7',
      ADMIN_PRIMARY_ACTIVE: '#089A96',
      ADMIN_QUALITY_MIN_SUCCESS_RATE: 0.95,
      ADMIN_QUALITY_MAX_SLOW_SHARE: 0.05,
    });
  });

  it('takes values from the environment, with colours in upper case', async () => {
    const { buildVars } = await load({
      ADMIN_PRODUCT_NAME: '  Ploy Console ',
      ADMIN_PRIMARY_COLOR: '#2563eb',
      ADMIN_QUALITY_MIN_SUCCESS_RATE: '0.9',
    });
    expect(buildVars.ADMIN_PRODUCT_NAME).toBe('Ploy Console');
    expect(buildVars.ADMIN_PRIMARY_COLOR).toBe('#2563EB');
    expect(buildVars.ADMIN_QUALITY_MIN_SUCCESS_RATE).toBe(0.9);
  });

  it('accepts a product name in any script', async () => {
    for (const name of ['คอนโซล', 'لوحة التحكم', '控制台', 'Bảng điều khiển', 'Panel 😀']) {
      expect((await load({ ADMIN_PRODUCT_NAME: name })).buildVars.ADMIN_PRODUCT_NAME).toBe(name);
    }
  });

  it('refuses a colour that is not 6-digit hex', async () => {
    for (const bad of ['teal', '#abc', '#12345G', '0ABAB5']) {
      await expect(load({ ADMIN_PRIMARY_COLOR: bad })).rejects.toThrow(/ADMIN_PRIMARY_COLOR/);
    }
  });

  it('refuses a logo that is not a path on this site', async () => {
    for (const bad of ['https://assets.example.com/logo.svg', '//host/logo.svg', 'logo.svg']) {
      await expect(load({ ADMIN_LOGO_URL: bad })).rejects.toThrow(/ADMIN_LOGO_URL/);
    }
    expect((await load({ ADMIN_LOGO_URL: '/brand/logo.svg' })).buildVars.ADMIN_LOGO_URL).toBe(
      '/brand/logo.svg',
    );
  });

  it('refuses a threshold outside 0 to 1', async () => {
    for (const bad of ['1.5', '-0.1', 'abc']) {
      await expect(load({ ADMIN_QUALITY_MAX_SLOW_SHARE: bad })).rejects.toThrow(
        /ADMIN_QUALITY_MAX_SLOW_SHARE/,
      );
    }
  });
});

describe('toDefine', () => {
  it('passes the values as they are: Umi encodes them as JSON itself, so strings keep no quote marks', async () => {
    const { buildVars, toDefine } = await load();
    const define = toDefine(buildVars);
    expect(define).toEqual(buildVars);
    expect(define.ADMIN_PRIMARY_COLOR).toBe('#0ABAB5');
    expect(String(define.ADMIN_PRODUCT_NAME)).not.toContain('"');
  });

  it('is what Umi then writes into the bundle: JSON.stringify of the value once', async () => {
    const { buildVars, toDefine } = await load();
    const written = JSON.stringify(toDefine(buildVars).ADMIN_PRIMARY_COLOR);
    expect(written).toBe('"#0ABAB5"');
    expect(JSON.parse(written)).toBe('#0ABAB5');
  });
});
