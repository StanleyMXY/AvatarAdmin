import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The page of the 投诉 menu (spec 5.0 and 5.25).
const routes: AdminRoute[] = [
  menuGroup('complaints', [
    {
      path: '/complaints/likeness',
      name: 'likeness',
      component: './complaints/likeness',
      access: 'COMPLAINT:VIEW',
    },
  ]),
];

export default routes;
