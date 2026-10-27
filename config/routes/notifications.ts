import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 站内通知 page (spec 5.0 and 5.20) joins the 用户 menu. It is opened with NOTIFICATION:VIEW; the
// button and the dialog that send ask for NOTIFICATION:SEND themselves.
const routes: AdminRoute[] = [
  menuGroup('users', [
    {
      path: '/users/notifications',
      name: 'notifications',
      component: './notifications/list',
      access: 'NOTIFICATION:VIEW',
    },
  ]),
];

export default routes;
