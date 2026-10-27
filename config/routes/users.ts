import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 用户 menu (spec 5.0): the list, abuse detection, the user detail and the deletion tasks. The
// notification page joins the same menu from config/routes/notifications.ts (the menu is merged by
// name and the pages are put in the order of the table). The detail is a route of its own
// (`/users/:id`, with the tab chosen by `?tab=`) and has no menu entry; the tabs, the ban and
// deletion buttons are shown by the page according to the codes the administrator holds.
const routes: AdminRoute[] = [
  menuGroup('users', [
    {
      path: '/users/list',
      name: 'list',
      component: './users/list',
      access: 'USER:VIEW',
    },
    {
      path: '/users/abuse',
      name: 'abuse',
      component: './users/abuse',
      access: 'ABUSE:VIEW',
    },
    {
      path: '/users/:id',
      name: 'detail',
      component: './users/detail',
      access: 'USER:VIEW',
      hideInMenu: true,
    },
    {
      path: '/users/deletions',
      name: 'deletions',
      component: './users/deletions',
      access: 'USER:DELETION',
    },
  ]),
];

export default routes;
