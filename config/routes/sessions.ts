import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 通话 menu (spec 5.0 and 5.5): the session list, call analytics and call quality. The session
// details open in a drawer of the list page, so they have no route. The list is read with
// SESSION:VIEW, the two reports with STATS:VIEW; the export and the re-landing bar of the quality
// page ask for STATS:EXPORT and STATS:LAND themselves.
const routes: AdminRoute[] = [
  menuGroup('sessions', [
    {
      path: '/sessions/list',
      name: 'list',
      component: './sessions/list',
      access: 'SESSION:VIEW',
    },
    {
      path: '/sessions/analytics',
      name: 'analytics',
      component: './sessions/analytics',
      access: 'STATS:VIEW',
    },
    {
      path: '/sessions/quality',
      name: 'quality',
      component: './sessions/quality',
      access: 'STATS:VIEW',
    },
  ]),
];

export default routes;
