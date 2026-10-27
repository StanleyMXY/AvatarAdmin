import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 系统监控 menu (spec 5.0): the pipeline charts and the background alerts. Closing an alert needs
// MONITOR:MANAGE; the button checks it.
const routes: AdminRoute[] = [
  menuGroup('monitor', [
    { path: '/monitor', name: 'pipeline', component: './monitor/pipeline', access: 'MONITOR:VIEW' },
    {
      path: '/monitor/alerts',
      name: 'alerts',
      component: './monitor/alerts',
      access: 'MONITOR:VIEW',
    },
  ]),
];

export default routes;
