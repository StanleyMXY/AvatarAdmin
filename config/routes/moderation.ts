import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 内容审核 menu (spec 5.0): the queue and the detail page share one row of the table (the detail is
// a route of its own, `/moderation/:id`, and has no menu entry), then the text rules and the
// statistics. The detail's content area and the decision buttons need MODERATION:REVIEW; the page
// checks that, the route only needs the view code.
const routes: AdminRoute[] = [
  menuGroup('moderation', [
    {
      path: '/moderation/queue',
      name: 'queue',
      component: './moderation/queue',
      access: 'MODERATION:VIEW',
    },
    {
      path: '/moderation/:id',
      name: 'detail',
      component: './moderation/detail',
      access: 'MODERATION:VIEW',
      hideInMenu: true,
    },
    {
      path: '/moderation/rules',
      name: 'rules',
      component: './moderation/rules',
      access: 'MODERATION:CONFIG',
    },
    {
      path: '/moderation/stats',
      name: 'stats',
      component: './moderation/stats',
      access: 'MODERATION:VIEW',
    },
  ]),
];

export default routes;
