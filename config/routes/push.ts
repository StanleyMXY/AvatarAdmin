import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 推送 menu (spec 5.0): the templates, the manual tasks, the periodic pushes, the send records, the
// results and the recall parameters. The record detail opens in its row, so it has no route. The
// buttons of a page check the code of their own endpoint again.
const routes: AdminRoute[] = [
  menuGroup('push', [
    {
      path: '/push/templates',
      name: 'templates',
      component: './push/templates',
      access: 'PUSH:TEMPLATE',
    },
    { path: '/push/tasks', name: 'tasks', component: './push/tasks', access: 'PUSH:SEND' },
    {
      path: '/push/schedules',
      name: 'schedules',
      component: './push/schedules',
      access: 'PUSH:SEND',
    },
    { path: '/push/records', name: 'records', component: './push/records', access: 'PUSH:VIEW' },
    { path: '/push/stats', name: 'stats', component: './push/stats', access: 'STATS:VIEW' },
    { path: '/push/recall', name: 'recall', component: './push/recall', access: 'PUSH:CONFIG' },
  ]),
];

export default routes;
