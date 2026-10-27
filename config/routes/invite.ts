import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 邀请 menu (spec 5.0 and 5.12): the four pages are read with INVITE:VIEW. The reward settings
// page (INVITE:CONFIG) hangs under the 活动管理 menu in the table, so it is added to that menu from
// here; the menus are merged by name, so the activity module adds its own pages to the same menu
// from config/routes/activity.ts without this file knowing them.
const routes: AdminRoute[] = [
  menuGroup('invite', [
    {
      path: '/invite/codes',
      name: 'codes',
      component: './invite/codes',
      access: 'INVITE:VIEW',
    },
    {
      path: '/invite/records',
      name: 'records',
      component: './invite/records',
      access: 'INVITE:VIEW',
    },
    {
      path: '/invite/stats',
      name: 'stats',
      component: './invite/stats',
      access: 'INVITE:VIEW',
    },
    {
      path: '/invite/share-stats',
      name: 'shareStats',
      component: './invite/shareStats',
      access: 'INVITE:VIEW',
    },
  ]),
  menuGroup('activity', [
    {
      path: '/invite/rewards',
      name: 'inviteRewards',
      component: './invite/rewards',
      access: 'INVITE:CONFIG',
    },
  ]),
];

export default routes;
