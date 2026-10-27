import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 统计报表 menu (spec 5.0). Daily report and retention report; the guest statistics page joins
// the same menu. Both pages are read with STATS:VIEW; the export and the re-landing bar ask for
// STATS:EXPORT and STATS:LAND themselves.
const routes: AdminRoute[] = [
  menuGroup('stats', [
    {
      path: '/stat/daily',
      name: 'daily',
      component: './stat/daily',
      access: 'STATS:VIEW',
    },
    {
      path: '/stat/retention',
      name: 'retention',
      component: './stat/retention',
      access: 'STATS:VIEW',
    },
    {
      path: '/stat/guest',
      name: 'guest',
      component: './stat/guest',
      access: 'STATS:VIEW',
    },
  ]),
];

export default routes;
