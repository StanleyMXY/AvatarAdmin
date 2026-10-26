import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  activateDeclaration,
  activateDefaultAvatar,
  backfillAction,
  createAction,
  createCosmetic,
  createDeclaration,
  createDefaultAvatar,
  createRendererModel,
  deleteDefaultAvatar,
  generateDefaultAvatar,
  getAccountAvatars,
  grantCosmetic,
  listActions,
  listCosmetics,
  listDeclarations,
  listDefaultAvatars,
  listGenerationTasks,
  listRendererModels,
  renameDefaultAvatar,
  setActionEnabled,
  setCosmeticEnabled,
  setRendererModelEnabled,
  updateAction,
  updateCosmetic,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('the catalogs', () => {
  it('lists cosmetics with the paging and the three filters, and leaves an empty filter out', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 41 });
    const page = await listCosmetics({
      page: 2,
      pageSize: 20,
      kind: 'OUTFIT',
      enabled: false,
      style: 'REALISTIC',
    });
    expect(calls[0].url).toBe(
      '/api/admin/cosmetics?page=2&pageSize=20&kind=OUTFIT&enabled=false&style=REALISTIC',
    );
    expect(page).toEqual({ items: [{ id: '1' }], total: 41 });
    await listCosmetics({ page: 1, pageSize: 20 });
    expect(calls[1].url).toBe('/api/admin/cosmetics?page=1&pageSize=20');
  });

  it('cuts the page itself when the answer has no total (a list that is not paged)', async () => {
    const rows = Array.from({ length: 45 }, (_, n) => ({ id: String(n) }));
    answer({ items: rows });
    const second = await listActions({ page: 2, pageSize: 20 });
    expect(second.total).toBe(45);
    expect(second.items.map((r) => r.id)).toEqual(rows.slice(20, 40).map((r) => r.id));
  });

  it('creates a cosmetic with previewUploadId and no address, and updates it by id', async () => {
    const calls = answer({ id: '5' });
    const base = {
      names: { en: 'Red dress' },
      generationSpec: 'a red dress',
      compatibleStyles: ['STYLIZED_3D' as const],
      surfaces: [],
      creditPrice: null,
      isFree: false,
      isDefault: false,
      sortOrder: 3,
    };
    await createCosmetic({ ...base, key: 'red_dress', kind: 'OUTFIT', previewUploadId: 'up-1' });
    expect(calls[0].url).toBe('/api/admin/cosmetics');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toMatchObject({ key: 'red_dress', previewUploadId: 'up-1' });
    expect(JSON.stringify(body(calls[0]))).not.toContain('previewUrl');
    await updateCosmetic('a/b', base);
    expect(calls[1].url).toBe('/api/admin/cosmetics/a%2Fb');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1]).creditPrice).toBeNull();
    expect('previewUploadId' in body(calls[1])).toBe(false);
  });

  it('switches cosmetics, actions and renderer models with {enabled}', async () => {
    const calls = answer({});
    await setCosmeticEnabled('1', true);
    await setActionEnabled('2', false);
    await setRendererModelEnabled('3', true);
    expect(calls.map((c) => [c.init.method, c.url, body(c)])).toEqual([
      ['PUT', '/api/admin/cosmetics/1/enabled', { enabled: true }],
      ['PUT', '/api/admin/actions/2/enabled', { enabled: false }],
      ['PUT', '/api/admin/renderer-models/3/enabled', { enabled: true }],
    ]);
  });

  it('creates and updates an action with iconUploadId', async () => {
    const calls = answer({});
    const base = {
      names: { en: 'Wave' },
      description: 'Waves hello',
      generationSpec: 'waves',
      compatibleStyles: ['REALISTIC' as const],
      surfaces: [],
      triggerableBy: 'BOTH' as const,
      sortOrder: 1,
    };
    await createAction({ ...base, key: 'wave', iconUploadId: 'ic-1', enabled: false });
    await updateAction('7', base);
    expect(body(calls[0])).toMatchObject({
      key: 'wave',
      iconUploadId: 'ic-1',
      triggerableBy: 'BOTH',
    });
    expect(calls[1].url).toBe('/api/admin/actions/7');
    expect('iconUploadId' in body(calls[1])).toBe(false);
  });

  it('backfills an action and returns the number of scheduled tasks', async () => {
    const calls = answer({ scheduled: 4 });
    expect(await backfillAction('7')).toEqual({ scheduled: 4 });
    expect(calls[0].url).toBe('/api/admin/actions/7/backfill');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBeUndefined();
  });
});

describe('declarations and renderer models', () => {
  it('lists declarations, creates a version with its texts and activates it by version', async () => {
    const calls = answer({ items: [{ version: 'v1' }], total: 1 });
    await listDeclarations({ page: 1, pageSize: 20 });
    expect(calls[0].url).toBe('/api/admin/declarations?page=1&pageSize=20');
    await createDeclaration({ version: '2026 v2', texts: { en: 'I agree', th: 'ฉันยอมรับ' } });
    expect(calls[1].init.method).toBe('POST');
    expect(body(calls[1])).toEqual({ version: '2026 v2', texts: { en: 'I agree', th: 'ฉันยอมรับ' } });
    await activateDeclaration('2026 v2');
    expect(calls[2].url).toBe('/api/admin/declarations/2026%20v2/activate');
    expect(calls[2].init.method).toBe('PUT');
  });

  it('registers a renderer model with the uploadId and the six fields, and no sha256 or size', async () => {
    const calls = answer({});
    await listRendererModels({ page: 1, pageSize: 20 });
    await createRendererModel({
      uploadId: 'u9',
      rendererKind: 'AVATAR_RENDERER_V1',
      version: '1.0.0',
      platform: 'ANDROID',
      abi: 'arm64-v8a',
      rendererFormatVersion: 1,
      minVersionCode: 100,
    });
    expect(calls[1].url).toBe('/api/admin/renderer-models');
    expect(Object.keys(body(calls[1])).sort()).toEqual(
      [
        'abi',
        'minVersionCode',
        'platform',
        'rendererFormatVersion',
        'rendererKind',
        'uploadId',
        'version',
      ].sort(),
    );
  });

  it('asks for failed generation tasks only, with the type filter', async () => {
    const calls = answer({ items: [], total: 0 });
    await listGenerationTasks({ page: 1, pageSize: 20, type: 'ACTION_CLIP' });
    await listGenerationTasks({ page: 1, pageSize: 20 });
    expect(calls[0].url).toBe(
      '/api/admin/generation-tasks?page=1&pageSize=20&status=FAILED&type=ACTION_CLIP',
    );
    expect(calls[1].url).toBe('/api/admin/generation-tasks?page=1&pageSize=20&status=FAILED');
  });
});

describe('default avatars', () => {
  it('reads the list that is not paged', async () => {
    const calls = answer({ items: [{ id: 'd1' }] });
    expect(await listDefaultAvatars()).toEqual({ items: [{ id: 'd1' }] });
    expect(calls[0].url).toBe('/api/admin/default-avatars');
  });

  it('creates with name, style and sourceUploadId only (no portraitAuthorized)', async () => {
    const calls = answer({ id: 'd1' });
    await createDefaultAvatar({ name: 'Mira', style: 'REALISTIC', sourceUploadId: 'src-1' });
    expect(body(calls[0])).toEqual({ name: 'Mira', style: 'REALISTIC', sourceUploadId: 'src-1' });
  });

  it('renames with {name} only, and generates, activates and deletes by id', async () => {
    const calls = answer({ id: 'd1' });
    await renameDefaultAvatar('d1', 'Nova');
    await generateDefaultAvatar('d1');
    await activateDefaultAvatar('d1');
    await deleteDefaultAvatar('d1');
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['PUT', '/api/admin/default-avatars/d1'],
      ['POST', '/api/admin/default-avatars/d1/generate'],
      ['POST', '/api/admin/default-avatars/d1/activate'],
      ['DELETE', '/api/admin/default-avatars/d1'],
    ]);
    expect(body(calls[0])).toEqual({ name: 'Nova' });
    expect(calls[1].init.body).toBeUndefined();
  });
});

describe('the account side (the user detail page)', () => {
  it('reads the avatars, looks and cosmetics of an account', async () => {
    const calls = answer({ avatars: [], cosmetics: [] });
    expect(await getAccountAvatars('acc/1')).toEqual({ avatars: [], cosmetics: [] });
    expect(calls[0].url).toBe('/api/admin/accounts/acc%2F1/avatars');
  });

  it('grants a cosmetic with itemId and reason', async () => {
    const calls = answer({});
    await grantCosmetic('acc1', { itemId: 'i1', reason: 'Gift' });
    expect(calls[0].url).toBe('/api/admin/accounts/acc1/cosmetics');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({ itemId: 'i1', reason: 'Gift' });
  });
});
