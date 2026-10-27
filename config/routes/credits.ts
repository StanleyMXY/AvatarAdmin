import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The credit pages of the 订阅与额度 menu (spec 5.0). The subscription module adds its pages to the
// same menu from config/routes/subscriptions.ts; the menu is merged by name and the pages are
// put in the order of the table.
const routes: AdminRoute[] = [
  menuGroup('subscriptions', [
    {
      path: '/credits/products',
      name: 'creditProducts',
      component: './credits/products',
      access: 'SUBSCRIPTION:CONFIG',
    },
    {
      path: '/credits/requests',
      name: 'creditRequests',
      component: './credits/requests',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/credits/accounts',
      name: 'creditAccounts',
      component: './credits/accounts',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/credits/transactions',
      name: 'creditTransactions',
      component: './credits/transactions',
      access: 'SUBSCRIPTION:VIEW',
    },
    {
      path: '/credits/stats',
      name: 'creditStats',
      component: './credits/stats',
      access: 'FINANCE:VIEW',
    },
  ]),
];

export default routes;
