import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 应用版本 (spec 5.0 and 5.19), a page of the 系统管理 menu. The page is opened with the viewing
// code; creating, editing, deleting a draft and uploading the APK ask for APPVERSION:MANAGE, and
// activating and taking down for APPVERSION:ACTIVATE, each button for its own code.
const routes: AdminRoute[] = [
  menuGroup('system', [
    {
      path: '/system/app-versions',
      name: 'appVersions',
      component: './appVersions/versions',
      access: 'APPVERSION:VIEW',
    },
  ]),
];

export default routes;
