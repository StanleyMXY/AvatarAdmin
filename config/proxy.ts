/**
 * Dev-server proxy for `npm run dev:api` (`MOCK=none`). Only the admin API prefix is forwarded;
 * the target is a development setting and is never baked into the build.
 * `npm run dev:mock` serves the same paths from `mock/` instead, so application code is identical.
 */
const target = process.env.ADMIN_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8080';

export default {
  '/api/': {
    target,
    changeOrigin: true,
  },
};
