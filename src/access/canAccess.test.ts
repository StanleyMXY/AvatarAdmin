import { describe, expect, it } from 'vitest';
import access from '../access';
import { type AdminRoute, canAccess, filterMenu } from './canAccess';
import { PERMISSION_CODES } from './permissionCodes';

const admin = (permissions: string[], superAdmin = false) => ({ superAdmin, permissions });

describe('PERMISSION_CODES', () => {
  it('has the 79 codes of this project, each once, in the form AREA:ACTION', () => {
    expect(PERMISSION_CODES).toHaveLength(79);
    expect(new Set(PERMISSION_CODES).size).toBe(79);
    for (const code of PERMISSION_CODES) expect(code).toMatch(/^[A-Z_]+(:[A-Z_]+)+$/);
  });

  it('includes the codes that the spec route table does not list but the spec text names', () => {
    for (const code of [
      'MEMORY:MODEL_REGISTER',
      'MEMORY:MODEL_ASSIGN',
      'USER:EMAIL_VIEW',
      'USER:PHONE_VIEW',
    ]) {
      expect(PERMISSION_CODES).toContain(code);
    }
  });

  it('has no code of another system', () => {
    expect(PERMISSION_CODES.some((code) => code.includes('SEND_RECORD'))).toBe(false);
    expect(PERMISSION_CODES.filter((code) => code.split(':').length > 3)).toEqual([]);
  });
});

describe('canAccess', () => {
  it('matches a code exactly', () => {
    const me = admin(['USER:VIEW']);
    expect(canAccess(me, 'USER:VIEW')).toBe(true);
    expect(canAccess(me, 'USER:BAN')).toBe(false);
  });

  it('does not match by prefix, wildcard or partial name', () => {
    expect(canAccess(admin(['USER:VIEW']), 'USER:VIEW_ALL')).toBe(false);
    expect(canAccess(admin(['USER:VIEW']), 'USER')).toBe(false);
    expect(canAccess(admin(['USER:VIEW_ALL']), 'USER:VIEW')).toBe(false);
    expect(canAccess(admin(['USER:*']), 'USER:VIEW')).toBe(false);
    expect(canAccess(admin(['*']), 'USER:VIEW')).toBe(false);
    expect(canAccess(admin(['USER']), 'USER:VIEW')).toBe(false);
    expect(canAccess(admin(['user:view']), 'USER:VIEW')).toBe(false);
  });

  it('lets a super administrator through every code', () => {
    const me = admin([], true);
    for (const code of PERMISSION_CODES) expect(canAccess(me, code)).toBe(true);
    expect(canAccess(me, 'ANYTHING:ELSE')).toBe(true);
  });

  it('treats only the boolean true as super administrator', () => {
    for (const odd of ['false', 'true', 1, {}, [], 'yes']) {
      expect(canAccess({ superAdmin: odd as never, permissions: [] }, 'USER:BAN')).toBe(false);
    }
  });

  it('does not strip white space from the codes it is given', () => {
    expect(canAccess(admin([' USER:VIEW ']), 'USER:VIEW')).toBe(false);
    expect(canAccess(admin(['USER:VIEW']), ' USER:VIEW')).toBe(false);
  });

  it('needs only a signed-in administrator when there is no code', () => {
    expect(canAccess(admin([]), undefined)).toBe(true);
    expect(canAccess(admin([]), '')).toBe(true);
  });

  it('is false for everyone who is not signed in, whatever the code', () => {
    expect(canAccess(undefined, undefined)).toBe(false);
    expect(canAccess(undefined, 'USER:VIEW')).toBe(false);
  });

  it('is false when the permission list is missing, not a crash', () => {
    expect(canAccess({ superAdmin: false } as never, 'USER:VIEW')).toBe(false);
  });
});

describe('access factory', () => {
  it('turns a route access string into the answer of canAccess', () => {
    const rules = access({ me: admin(['USER:VIEW']) });
    expect(rules['USER:VIEW']).toBe(true);
    expect(rules['USER:BAN']).toBe(false);
  });

  it('gives a canAccess function for buttons and columns', () => {
    const rules = access({ me: admin(['USER:BAN']) });
    expect(rules.canAccess('USER:BAN')).toBe(true);
    expect(rules.canAccess('USER:VIEW')).toBe(false);
    expect(rules.canAccess(undefined)).toBe(true);
  });

  it('has no code check for undefined: canAccess(undefined) is false before the administrator is known', () => {
    expect(access(undefined).canAccess(undefined)).toBe(false);
    expect(access({ me: admin([]) }).canAccess(undefined)).toBe(true);
  });

  it('denies everything before the administrator is known', () => {
    expect(access(undefined)['USER:VIEW']).toBe(false);
    expect(access({})['USER:VIEW']).toBe(false);
  });

  it('answers true for every code for a super administrator', () => {
    const rules = access({ me: admin([], true) });
    expect(PERMISSION_CODES.every((code) => rules[code] === true)).toBe(true);
  });

  it('does not answer for symbols and does not break JSON or inspection', () => {
    const rules = access({ me: admin(['A:B']) });
    expect((rules as unknown as Record<symbol, unknown>)[Symbol.toPrimitive]).toBeUndefined();
    expect(() => JSON.stringify(rules)).not.toThrow();
  });
});

describe('filterMenu', () => {
  const can =
    (...granted: string[]) =>
    (code?: string) =>
      code === undefined || granted.includes(code);

  const routes: AdminRoute[] = [
    { path: '/dashboard', name: 'dashboard', component: './dashboard' },
    {
      path: '/users',
      name: 'users',
      routes: [
        { path: '/users/list', name: 'list', component: './users/list', access: 'USER:VIEW' },
        { path: '/users/abuse', name: 'abuse', component: './users/abuse', access: 'ABUSE:VIEW' },
        {
          path: '/users/:id',
          name: 'detail',
          component: './users/detail',
          access: 'USER:VIEW',
          hideInMenu: true,
        },
      ],
    },
    {
      path: '/system',
      name: 'system',
      routes: [
        { path: '/system/audit', name: 'audit', component: './audit', access: 'AUDIT:VIEW' },
      ],
    },
  ];

  it('hides a parent whose children are all without permission', () => {
    const visible = filterMenu(routes, can());
    expect(visible.map((r) => r.path)).toEqual(['/dashboard']);
  });

  it('shows a parent with the one child that has permission, and only that child', () => {
    const visible = filterMenu(routes, can('ABUSE:VIEW'));
    expect(visible.map((r) => r.path)).toEqual(['/dashboard', '/users']);
    expect(visible[1].routes?.map((r) => r.path)).toEqual(['/users/abuse']);
  });

  it('keeps the order of the routes', () => {
    const visible = filterMenu(routes, can('USER:VIEW', 'ABUSE:VIEW', 'AUDIT:VIEW'));
    expect(visible.map((r) => r.path)).toEqual(['/dashboard', '/users', '/system']);
    expect(visible[1].routes?.map((r) => r.path)).toEqual(['/users/list', '/users/abuse']);
  });

  it('leaves out detail routes marked hideInMenu and routes without a name', () => {
    const visible = filterMenu(
      [
        ...routes,
        { path: '/', redirect: '/dashboard' },
        { path: '/user/login', layout: false, component: './login' },
        { path: '/x', component: './x' },
      ],
      can('USER:VIEW'),
    );
    expect(visible[1].routes?.map((r) => r.path)).toEqual(['/users/list']);
    expect(visible.map((r) => r.path)).toEqual(['/dashboard', '/users']);
  });

  it('hides a whole subtree when the parent itself has an access code the administrator lacks', () => {
    const visible = filterMenu(
      [
        {
          path: '/p',
          name: 'p',
          access: 'ADMIN:MANAGE',
          routes: [{ path: '/p/a', name: 'a', component: './a' }],
        },
      ],
      can(),
    );
    expect(visible).toEqual([]);
  });

  it('works through nested levels', () => {
    const nested: AdminRoute[] = [
      {
        path: '/a',
        name: 'a',
        routes: [
          {
            path: '/a/b',
            name: 'b',
            routes: [{ path: '/a/b/c', name: 'c', component: './c', access: 'AUDIT:VIEW' }],
          },
        ],
      },
    ];
    expect(filterMenu(nested, can())).toEqual([]);
    expect(filterMenu(nested, can('AUDIT:VIEW'))[0].routes?.[0].routes?.[0].path).toBe('/a/b/c');
  });

  it('does not change the routes it was given', () => {
    const before = JSON.stringify(routes);
    filterMenu(routes, can('USER:VIEW'));
    expect(JSON.stringify(routes)).toBe(before);
  });

  it('gives an empty menu for no routes', () => {
    expect(filterMenu([], can())).toEqual([]);
  });
});
