import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import avatar from './avatar';
import complaints from './complaints';

const avatarPages = avatar.flatMap((group) => group.routes ?? []);
const complaintPages = complaints.flatMap((group) => group.routes ?? []);

const visible = (groups: typeof avatar, permissions: string[]) =>
  filterMenu(groups, access({ me: { superAdmin: false, permissions } }).canAccess)
    .flatMap((g) => g.routes ?? [])
    .map((r) => r.path);

describe('the avatar routes (spec 5.0, the 形象与装扮 rows)', () => {
  it('are the six pages with the paths, permission codes and files of the table', () => {
    expect(avatarPages.map((p) => [p.path, p.access, p.component])).toEqual([
      ['/avatar/cosmetics', 'COSMETIC:MANAGE', './avatar/cosmetics'],
      ['/avatar/actions', 'ACTION:MANAGE', './avatar/actions'],
      ['/avatar/declarations', 'DECLARATION:MANAGE', './avatar/declarations'],
      ['/avatar/renderer-models', 'RENDERER:MANAGE', './avatar/rendererModels'],
      ['/avatar/generation-tasks', 'GENERATION:VIEW', './avatar/generationTasks'],
      ['/avatar/default-avatars', 'DEFAULT_AVATAR:MANAGE', './avatar/defaultAvatars'],
    ]);
  });

  it('sit in the avatar menu, and the complaint page in the complaints menu', () => {
    expect(avatar).toHaveLength(1);
    expect(avatar[0]).toMatchObject({ key: 'avatar', name: 'avatar' });
    expect(complaints).toHaveLength(1);
    expect(complaints[0]).toMatchObject({ key: 'complaints', name: 'complaints' });
    expect(complaintPages.map((p) => [p.path, p.access, p.component])).toEqual([
      ['/complaints/likeness', 'COMPLAINT:VIEW', './complaints/likeness'],
    ]);
  });

  it('are in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    for (const page of [...avatarPages, ...complaintPages]) expect(paths).toContain(page.path);
    expect(paths.filter((p) => p?.startsWith('/avatar/'))).toEqual(avatarPages.map((p) => p.path));
  });

  it('show each page only to the one permission code of its row', () => {
    expect(visible(avatar, ['COSMETIC:GRANT'])).toEqual([]);
    expect(visible(avatar, ['COSMETIC:MANAGE'])).toEqual(['/avatar/cosmetics']);
    expect(visible(avatar, ['GENERATION:VIEW', 'DEFAULT_AVATAR:MANAGE'])).toEqual([
      '/avatar/generation-tasks',
      '/avatar/default-avatars',
    ]);
    expect(visible(avatar, [])).toEqual([]);
    expect(visible(complaints, ['COMPLAINT:MANAGE'])).toEqual([]);
    expect(visible(complaints, ['COMPLAINT:VIEW'])).toEqual(['/complaints/likeness']);
  });
});
