import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { flattenPages, problemsIn } from './assembleRoutes';
import routes from './routes';

// The module names are shared by services/, pages/, mock/, locales/ and config/routes/ (plan, file structure).
const MODULES = [
  'auth',
  'stats',
  'config',
  'companionship',
  'subscriptions',
  'credits',
  'memory',
  'monitor',
  'support',
  'avatar',
  'complaints',
  'moderation',
  'users',
  'sessions',
  'analytics',
  'dashboard',
  'push',
  'invite',
  'activity',
  'campaign',
  'cost',
  'ads',
  'sms',
  'email',
  'appVersions',
  'channels',
  'notifications',
  'clientConfig',
  'system',
];

describe('config/routes.ts', () => {
  it('has one route file per module', () => {
    const files = readdirSync('config/routes').filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    );
    expect(files.map((f) => f.replace(/\.ts$/, '')).sort()).toEqual([...MODULES].sort());
    for (const name of MODULES) expect(existsSync(`config/routes/${name}.ts`)).toBe(true);
  });

  it('redirects the root path to /dashboard', () => {
    const root = routes.find((r) => r.path === '/');
    expect(root).toMatchObject({ redirect: '/dashboard' });
  });

  it('ends with the catch-all route', () => {
    expect(routes.at(-1)?.path).toBe('*');
  });

  it('puts the root redirect before every menu', () => {
    const paths = routes.map((r) => r.path);
    const firstMenu = routes.findIndex((r) => r.name !== undefined);
    if (firstMenu !== -1) expect(paths.indexOf('/')).toBeLessThan(firstMenu);
  });

  it('has only access values that are permission codes, no repeated path, and a component or children for every named route', () => {
    expect(problemsIn(routes)).toEqual([]);
  });

  it('every page route has an access that is a permission code or none', () => {
    for (const page of flattenPages(routes)) {
      if (page.access !== null) expect(PERMISSION_CODES).toContain(page.access);
    }
  });

  it('places /users/abuse before /users/:id when both exist', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    const abuse = paths.indexOf('/users/abuse');
    const detail = paths.indexOf('/users/:id');
    if (abuse !== -1 && detail !== -1) expect(abuse).toBeLessThan(detail);
  });
});
