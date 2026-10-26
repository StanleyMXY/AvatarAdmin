import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 系统管理 (spec 5.0 and 5.16): administrators, roles, the permission tree and the audit log. The
// app version and channel package pages of the same menu are added by their own route files. Each page
// is opened with the code of its endpoints; the permission tree can also be read with ROLE:MANAGE (the
// role dialog does that) but its page, which edits the tree, is for PERMISSION:MANAGE.
const routes: AdminRoute[] = [
  menuGroup('system', [
    {
      path: '/system/admins',
      name: 'admins',
      component: './system/admins',
      access: 'ADMIN:MANAGE',
    },
    {
      path: '/system/roles',
      name: 'roles',
      component: './system/roles',
      access: 'ROLE:MANAGE',
    },
    {
      path: '/system/permissions',
      name: 'permissions',
      component: './system/permissions',
      access: 'PERMISSION:MANAGE',
    },
    {
      path: '/system/audit',
      name: 'audit',
      component: './system/audit',
      access: 'AUDIT:VIEW',
    },
  ]),
];

export default routes;
