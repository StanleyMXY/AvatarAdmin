import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// 记忆服务 menu (spec 5.0): the tiers and the embedding models. The writes need their own codes
// (MEMORY:TIER_CONFIG, MEMORY:MODEL_REGISTER, MEMORY:MODEL_ASSIGN); the buttons check them.
const routes: AdminRoute[] = [
  menuGroup('memory', [
    { path: '/memory/tiers', name: 'tiers', component: './memory/tiers', access: 'MEMORY:VIEW' },
    { path: '/memory/models', name: 'models', component: './memory/models', access: 'MEMORY:VIEW' },
  ]),
];

export default routes;
