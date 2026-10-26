import type { AdminRoute } from '../../src/access/canAccess';
import { menuGroup } from '../menus';

// The six pages of the 形象与装扮 menu (spec 5.0 and 5.24), in the order of the table.
const routes: AdminRoute[] = [
  menuGroup('avatar', [
    {
      path: '/avatar/cosmetics',
      name: 'cosmetics',
      component: './avatar/cosmetics',
      access: 'COSMETIC:MANAGE',
    },
    {
      path: '/avatar/actions',
      name: 'actions',
      component: './avatar/actions',
      access: 'ACTION:MANAGE',
    },
    {
      path: '/avatar/declarations',
      name: 'declarations',
      component: './avatar/declarations',
      access: 'DECLARATION:MANAGE',
    },
    {
      path: '/avatar/renderer-models',
      name: 'rendererModels',
      component: './avatar/rendererModels',
      access: 'RENDERER:MANAGE',
    },
    {
      path: '/avatar/generation-tasks',
      name: 'generationTasks',
      component: './avatar/generationTasks',
      access: 'GENERATION:VIEW',
    },
    {
      path: '/avatar/default-avatars',
      name: 'defaultAvatars',
      component: './avatar/defaultAvatars',
      access: 'DEFAULT_AVATAR:MANAGE',
    },
  ]),
];

export default routes;
