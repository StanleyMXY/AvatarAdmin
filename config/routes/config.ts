import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 系统配置 menu: the backend parameters page. The client configuration page joins this menu from
// config/routes/clientConfig.ts.
const routes: AdminRoute[] = [
  menuGroup('config', [
    { path: '/config', name: 'backend', component: './config', access: 'CONFIG:MANAGE' },
  ]),
];

export default routes;
