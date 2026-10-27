import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 客服 menu (spec 5.0): the feedback list; the detail is a drawer, not a route. Retrying needs
// SUPPORT:MANAGE; the button checks it.
const routes: AdminRoute[] = [
  menuGroup('support', [
    {
      path: '/support/feedback',
      name: 'feedback',
      component: './support/feedback',
      access: 'SUPPORT:VIEW',
    },
  ]),
];

export default routes;
