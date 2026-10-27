import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, undefined as never);
    else vi.stubEnv(key, value);
  }
  return (await import('./proxy')).default as Record<
    string,
    { target: string; changeOrigin: boolean }
  >;
};

afterEach(() => vi.unstubAllEnvs());

describe('config/proxy.ts', () => {
  it('forwards /api/ to the target only when the mock backend is off (dev:api)', async () => {
    const proxy = await load({ MOCK: 'none', ADMIN_API_PROXY_TARGET: 'http://127.0.0.1:9999' });
    expect(Object.keys(proxy)).toEqual(['/api/']);
    expect(proxy['/api/'].target).toBe('http://127.0.0.1:9999');
    expect(proxy['/api/'].changeOrigin).toBe(true);
  });

  it('uses 127.0.0.1:8080 when no target is given', async () => {
    const proxy = await load({ MOCK: 'none', ADMIN_API_PROXY_TARGET: '  ' });
    expect(proxy['/api/'].target).toBe('http://127.0.0.1:8080');
  });

  it('has no proxy in the mock mode (dev:mock), so an endpoint without a mock cannot reach a real backend', async () => {
    expect(await load({ MOCK: undefined })).toEqual({});
    expect(await load({ MOCK: '' })).toEqual({});
    expect(await load({ MOCK: 'true' })).toEqual({});
  });
});
