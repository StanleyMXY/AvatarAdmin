import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 活动管理 menu (spec 5.0 and 5.22): the sign-in and daily task pages. The reward settings page
// (INVITE:CONFIG) belongs to the same menu and is added by config/routes/invite.ts; the menus are
// merged by name and the pages are put in the order of the table, so this file does not know it.
const routes: AdminRoute[] = [
  menuGroup('activity', [
    {
      path: '/act/act-signin-config',
      name: 'signinConfig',
      component: './activity/signinConfig',
      access: 'CHECKIN:VIEW',
    },
    {
      path: '/act/act-signin-record',
      name: 'signinRecord',
      component: './activity/signinRecord',
      access: 'CHECKIN:VIEW',
    },
    {
      path: '/act/act-signin-stats',
      name: 'signinStats',
      component: './activity/signinStats',
      access: 'STATS:VIEW',
    },
    {
      path: '/act/act-task-config',
      name: 'taskConfig',
      component: './activity/taskConfig',
      access: 'TASK:VIEW',
    },
    {
      path: '/act/act-task-record',
      name: 'taskRecord',
      component: './activity/taskRecord',
      access: 'TASK:VIEW',
    },
    {
      path: '/act/act-task-stats',
      name: 'taskStats',
      component: './activity/taskStats',
      access: 'STATS:VIEW',
    },
  ]),
];

export default routes;
