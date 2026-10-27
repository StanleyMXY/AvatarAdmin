import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 成本 menu (spec 5.0 and 5.23): the cost report and the prices. Both are read with COST:VIEW;
// the writes on the price page (confirm, reject, withdraw, enter by hand, change the model
// registration) ask for COST:PRICE themselves, and the export and the re-landing bar of the report
// ask for STATS:EXPORT and STATS:LAND.
const routes: AdminRoute[] = [
  menuGroup('cost', [
    { path: '/cost/report', name: 'report', component: './cost/report', access: 'COST:VIEW' },
    { path: '/cost/prices', name: 'prices', component: './cost/prices', access: 'COST:VIEW' },
  ]),
];

export default routes;
