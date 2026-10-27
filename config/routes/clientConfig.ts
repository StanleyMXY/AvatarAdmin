import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 客户端配置 page (spec 5.0 and 5.21) joins the 系统配置 menu. It is opened with
// CLIENTCONFIG:VIEW; saving and resetting ask for CLIENTCONFIG:MANAGE themselves.
const routes: AdminRoute[] = [
  menuGroup('config', [
    {
      path: '/config/client',
      name: 'client',
      component: './clientConfig/list',
      access: 'CLIENTCONFIG:VIEW',
    },
  ]),
];

export default routes;
