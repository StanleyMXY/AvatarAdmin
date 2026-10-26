import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 短信管理 menu (spec 5.0 and 5.18): channels, templates and send records. Each page is opened
// with the code of its own resource; the writes, the test send, the full number and the export ask
// for their own codes (SMS:CHANNEL:CONFIG, SMS:RECORD:PHONE_VIEW, SMS:RECORD:EXPORT) themselves.
const routes: AdminRoute[] = [
  menuGroup('sms', [
    {
      path: '/sms/channels',
      name: 'channels',
      component: './sms/channels',
      access: 'SMS:CHANNEL',
    },
    {
      path: '/sms/templates',
      name: 'templates',
      component: './sms/templates',
      access: 'SMS:TEMPLATE',
    },
    {
      path: '/sms/records',
      name: 'records',
      component: './sms/records',
      access: 'SMS:RECORD',
    },
  ]),
];

export default routes;
