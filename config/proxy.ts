/**
 * Dev-server proxy for `npm run dev:api` (`MOCK=none`). Only the admin API prefix is forwarded;
 * the target is a development setting and is never baked into the build.
 * `npm run dev:mock` serves the same paths from `mock/` and has no proxy: an endpoint without a
 * mock must not quietly reach whatever listens on the proxy target.
 */
const target = process.env.ADMIN_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8080';

const proxy: Record<string, { target: string; changeOrigin: boolean }> =
  process.env.MOCK === 'none' ? { '/api/': { target, changeOrigin: true } } : {};

export default proxy;
