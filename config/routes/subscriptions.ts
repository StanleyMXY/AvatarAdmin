import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The subscription pages of the 订阅与额度 menu (spec 5.0). The credit pages join the same menu from
// config/routes/credits.ts; the menu is merged by name and the pages are put in the order of the table.
// The four configuration pages are read with SUBSCRIPTION:VIEW (the read endpoints ask for it); the
// buttons that write ask for SUBSCRIPTION:CONFIG or SUBSCRIPTION:GRANT themselves.
const routes: AdminRoute[] = [
  menuGroup('subscriptions', [
    {
      path: '/subscriptions/list',
      name: 'list',
      component: './subscriptions/list',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/subscriptions/entitlements',
      name: 'entitlements',
      component: './subscriptions/entitlements',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/subscriptions/gates',
      name: 'gates',
      component: './subscriptions/gates',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/subscriptions/products',
      name: 'products',
      component: './subscriptions/products',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/subscriptions/events',
      name: 'events',
      component: './subscriptions/events',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/subscriptions/stats',
      name: 'stats',
      component: './subscriptions/stats',
      access: 'FINANCE:VIEW',
    },
  ]),
];

export default routes;
