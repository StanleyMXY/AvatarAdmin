import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 投放管理 menu (spec 5.0): the results, the accounts with their costs, the attribution details and
// the parameters. The accounts and the parameters need ATTRIBUTION:MANAGE, the two reports
// ATTRIBUTION:VIEW. The buttons of a page check the code of their own endpoint again.
const routes: AdminRoute[] = [
  menuGroup('campaign', [
    {
      path: '/campaign/stats',
      name: 'stats',
      component: './campaign/stats',
      access: 'ATTRIBUTION:VIEW',
    },
    {
      path: '/campaign/accounts',
      name: 'accounts',
      component: './campaign/accounts',
      access: 'ATTRIBUTION:MANAGE',
    },
    {
      path: '/campaign/attribution',
      name: 'attribution',
      component: './campaign/attribution',
      access: 'ATTRIBUTION:VIEW',
    },
    {
      path: '/campaign/settings',
      name: 'settings',
      component: './campaign/settings',
      access: 'ATTRIBUTION:MANAGE',
    },
  ]),
];

export default routes;
