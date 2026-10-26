import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The 应用内广告 menu (spec 5.0 and 5.17): campaigns, placements with the global settings, units,
// creatives and the report. Each page is opened with the code of its own resource; the writes of a
// page, the export and the landing bar of the report ask for the same code or for STATS:EXPORT and
// STATS:LAND themselves.
const routes: AdminRoute[] = [
  menuGroup('ads', [
    {
      path: '/ads/campaigns',
      name: 'campaigns',
      component: './ads/campaigns',
      access: 'ADS:CAMPAIGN',
    },
    {
      path: '/ads/placements',
      name: 'placements',
      component: './ads/placements',
      access: 'ADS:PLACEMENT',
    },
    { path: '/ads/units', name: 'units', component: './ads/units', access: 'ADS:UNIT' },
    {
      path: '/ads/creatives',
      name: 'creatives',
      component: './ads/creatives',
      access: 'ADS:CREATIVE',
    },
    { path: '/ads/report', name: 'report', component: './ads/report', access: 'ADS:REPORT' },
  ]),
];

export default routes;
