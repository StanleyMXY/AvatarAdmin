import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 总览 (spec 5.0 and 5.1). Every signed-in administrator can open it, so the route has no `access`;
// the page shows each card, the chart and the quick links only for the permission they need.
const routes: AdminRoute[] = [
  menuGroup('dashboard', [
    { path: '/dashboard', name: 'overview', component: './dashboard/overview' },
  ]),
];

export default routes;
