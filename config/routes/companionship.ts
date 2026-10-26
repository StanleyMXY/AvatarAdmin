import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

const routes: AdminRoute[] = [
  menuGroup('companionship', [
    {
      path: '/companionship',
      name: 'params',
      component: './companionship',
      access: 'COMPANIONSHIP:CONFIG',
    },
  ]),
];

export default routes;
