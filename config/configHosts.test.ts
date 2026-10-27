import { describe, expect, it } from 'vitest';
import { CONFIG_HOSTS, CONFIG_SCHEMA } from '../src/pages/config/configSchema';
import { flattenPages } from './assembleRoutes';
import routes from './routes';

// Execution ruling 8: the page that carries the keys of one permission must exist as a route.
// The system configuration page leaves the keys of these permissions out and points to the page.
describe('the pages that carry configuration keys', () => {
  const pages = new Map(flattenPages(routes).map((page) => [page.path, page.access]));

  it('has a route for every host page named in CONFIG_HOSTS', () => {
    for (const [code, path] of Object.entries(CONFIG_HOSTS))
      expect(pages.has(path as string), `${code} -> ${path}`).toBe(true);
  });

  it('names a host for every edit permission other than CONFIG:MANAGE that a key uses', () => {
    const used = new Set(CONFIG_SCHEMA.map((spec) => spec.editPermission));
    used.delete('CONFIG:MANAGE');
    expect([...used].sort()).toEqual(Object.keys(CONFIG_HOSTS).sort());
  });
});
