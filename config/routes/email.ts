import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 邮件模板 menu (spec 5.0 and 5.18a): one page, the templates of the system's e-mails.
const routes: AdminRoute[] = [
  menuGroup('email', [
    {
      path: '/email/templates',
      name: 'templates',
      component: './email/templates',
      access: 'EMAIL:TEMPLATE',
    },
  ]),
];

export default routes;
