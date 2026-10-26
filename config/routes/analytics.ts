import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 埋点管理 menu (spec 5.0 and 5.6): the three pages read with ANALYTICS:VIEW. Saving, changing and
// deleting a funnel need ANALYTICS:FUNNEL_MANAGE and the whole IP needs ANALYTICS:IP_VIEW; the pages
// check those.
const routes: AdminRoute[] = [
  menuGroup('analytics', [
    {
      path: '/analytics/summary',
      name: 'summary',
      component: './analytics/summary',
      access: 'ANALYTICS:VIEW',
    },
    {
      path: '/analytics/detail',
      name: 'detail',
      component: './analytics/detail',
      access: 'ANALYTICS:VIEW',
    },
    {
      path: '/analytics/funnel',
      name: 'funnel',
      component: './analytics/funnel',
      access: 'ANALYTICS:VIEW',
    },
  ]),
];

export default routes;
