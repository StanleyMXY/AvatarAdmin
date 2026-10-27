import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 渠道包 (spec 5.0 and 5.19), a page of the 系统管理 menu. The list is readable by any signed-in
// administrator (the dropdowns of the other pages use it); this page, which creates and changes
// channel packages, is opened with CHANNEL:MANAGE.
const routes: AdminRoute[] = [
  menuGroup('system', [
    {
      path: '/system/channels',
      name: 'channels',
      component: './channels/channels',
      access: 'CHANNEL:MANAGE',
    },
  ]),
];

export default routes;
