// The avatar and cosmetic endpoints of the mock backend (contract 3.6 to 3.10 and 17.4, the
// "形象与装扮" row; the backend note of 2026-10-21, points 1 to 3). State lives in
// _core/avatarData.ts. What the contract leaves open (the filters of the lists, whether they are
// paged, the answers of some writes) follows docs/contract-requests/
// 2026-10-26-admin-frontend-cosmetics-complaints.md. The likeness complaints are in complaints.mock.ts.

import { createHash } from 'node:crypto';
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import {
  avatarState,
  type MockAction,
  type MockCosmetic,
  type MockDefaultAvatar,
  type MockUpload,
  nextId,
  settleGenerations,
  signedUrl,
} from './_core/avatarData';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok, toUmiFile } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { text } from './_core/statRange';
import { writeAudit } from './_core/systemData';

type Detail = { ref: string; reason: string };

const STYLES = ['STYLIZED_3D', 'REALISTIC'];
const KINDS = ['OUTFIT', 'BACKGROUND'];
const TRIGGERS = ['USER', 'AGENT', 'BOTH'];
const PLATFORMS = ['ANDROID', 'IOS'];
const TASK_TYPES = ['AVATAR', 'VOICE', 'LOOK', 'LOOK_REPREPARE', 'ACTION_CLIP'];
const SPEC_MAX = 2000;
const NAME_MAX = 30;
const TEXT_MAX = 2000;

const fail = (details: Detail[], message = 'invalid request') => invalidRequest(message, details);

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);

const invalidState = (status: string, message: string) =>
  new MockHttpError(409, 'INVALID_STATE', message, { status });

const byIdAsc = (a: { id: string }, b: { id: string }) => Number(a.id) - Number(b.id);

// ---- the upload records: a file is uploaded first, then named by its uploadId ----

const UPLOAD_KINDS = {
  'catalog-image': 'CATALOG_IMAGE',
  'renderer-model': 'RENDERER_MODEL',
  'default-avatar-source': 'DEFAULT_AVATAR_SOURCE',
} as const;

function newUpload(kind: MockUpload['kind']) {
  const id = `upl-${String(avatarState.next.upload++).padStart(6, '0')}`;
  const upload: MockUpload = {
    id,
    kind,
    sizeBytes: kind === 'RENDERER_MODEL' ? 47_185_920 : 183_042,
    sha256: createHash('sha256').update(id).digest('hex'),
    used: false,
  };
  avatarState.uploads.set(id, upload);
  return upload;
}

/** The upload a request names: 404 when unknown, 400 when it is of another kind, 409 when it was used already. */
function uploadOf(id: unknown, kind: MockUpload['kind'], ref: string): MockUpload {
  if (typeof id !== 'string' || id === '') {
    throw fail([{ ref, reason: 'EMPTY_NOT_ALLOWED' }], `${ref} is required`);
  }
  const upload = avatarState.uploads.get(id);
  if (!upload) throw notFound('upload');
  if (upload.kind !== kind) {
    throw fail([{ ref, reason: 'OUT_OF_RANGE' }], `${ref} is the upload of another kind`);
  }
  if (upload.used) throw invalidState('USED', 'The upload belongs to another object already');
  return upload;
}

// ---- field checks shared by the catalogs ----

/** Texts by language tag; at least one must have text. */
function localized(value: unknown, ref: string, details: Detail[]): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
    return {};
  }
  const result: Record<string, string> = {};
  for (const [tag, raw] of Object.entries(value)) {
    if (typeof raw !== 'string') continue;
    const trimmed = trimSpec(raw);
    if (trimmed === '') continue;
    if (countCodePoints(trimmed) > TEXT_MAX) details.push({ ref, reason: 'TOO_LONG' });
    result[tag] = trimmed;
  }
  if (Object.keys(result).length === 0) details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
  return result;
}

/** An English description, trimmed with the contract's set and counted in code points (1 to 2000). */
function spec(value: unknown, ref: string, details: Detail[]): string {
  const trimmed = typeof value === 'string' ? trimSpec(value) : '';
  const length = countCodePoints(trimmed);
  if (length === 0) details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
  else if (length > SPEC_MAX) details.push({ ref, reason: 'TOO_LONG' });
  return trimmed;
}

function styles(value: unknown, details: Detail[]): MockCosmetic['compatibleStyles'] {
  if (!Array.isArray(value) || value.some((s) => typeof s !== 'string' || !STYLES.includes(s))) {
    details.push({ ref: 'compatibleStyles', reason: 'OUT_OF_RANGE' });
    return [];
  }
  return [...new Set(value)] as MockCosmetic['compatibleStyles'];
}

function surfaces(value: unknown, details: Detail[]): MockCosmetic['surfaces'] {
  if (!Array.isArray(value)) {
    details.push({ ref: 'surfaces', reason: 'OUT_OF_RANGE' });
    return [];
  }
  const rows: MockCosmetic['surfaces'] = [];
  for (const item of value) {
    const platform = (item as { platform?: unknown } | null)?.platform;
    const channel = (item as { channel?: unknown } | null)?.channel;
    if (
      typeof platform !== 'string' ||
      !PLATFORMS.includes(platform) ||
      !(channel === null || (typeof channel === 'string' && channel !== ''))
    ) {
      details.push({ ref: 'surfaces', reason: 'OUT_OF_RANGE' });
      return [];
    }
    rows.push({ platform: platform as 'ANDROID' | 'IOS', channel });
  }
  return rows;
}

function whole(value: unknown, ref: string, details: Detail[], min = 0): number {
  if (!isInt(value)) {
    details.push({ ref, reason: 'NOT_AN_INTEGER' });
    return 0;
  }
  if (value < min) details.push({ ref, reason: 'OUT_OF_RANGE' });
  return value;
}

function flag(value: unknown, ref: string, details: Detail[]): boolean {
  if (typeof value !== 'boolean') {
    details.push({ ref, reason: 'NOT_BOOLEAN' });
    return false;
  }
  return value;
}

const keyOf = (value: unknown, details: Detail[]): string => {
  const trimmed = typeof value === 'string' ? trimSpec(value) : '';
  if (trimmed === '') details.push({ ref: 'key', reason: 'EMPTY_NOT_ALLOWED' });
  return trimmed;
};

const cosmeticRow = (c: MockCosmetic) => {
  const { previewFile, ...rest } = c;
  return { ...rest, previewUrl: signedUrl(previewFile) };
};

const actionRow = (a: MockAction) => {
  const { iconFile, missingClips: _missing, ...rest } = a;
  return { ...rest, iconUrl: signedUrl(iconFile) };
};

const defaultAvatarRow = (d: MockDefaultAvatar) => ({
  id: d.id,
  name: d.name,
  style: d.style,
  status: d.status,
  isActive: d.isActive,
  failureReason: d.failureReason,
  lookId: d.lookId,
  sourceImageUrl: signedUrl(d.sourceFile),
  previewUrl: signedUrl(d.previewFile),
});

/** The name rule of contract 2.5.1: 1 to 30 code points after trimming, no control or bidirectional override characters. */
function nameProblem(value: unknown): { name: string; reason: string | null } {
  const name = typeof value === 'string' ? trimSpec(value) : '';
  const length = countCodePoints(name);
  if (length === 0) return { name, reason: 'EMPTY_NOT_ALLOWED' };
  if (length > NAME_MAX) return { name, reason: 'TOO_LONG' };
  if (/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(name)) return { name, reason: 'OUT_OF_RANGE' };
  return { name, reason: null };
}

function checkName(value: unknown): string {
  const { name, reason } = nameProblem(value);
  if (reason) throw fail([{ ref: 'name', reason }], 'The name is not allowed');
  return name;
}

const boolParam = (req: MockReq, name: string): boolean | undefined => {
  const raw = text(req.query[name]);
  if (raw === '') return undefined;
  if (raw !== 'true' && raw !== 'false') {
    throw fail([{ ref: name, reason: 'NOT_BOOLEAN' }], `${name} must be true or false`);
  }
  return raw === 'true';
};

const enumParam = (req: MockReq, name: string, allowed: string[]): string | undefined => {
  const raw = text(req.query[name]);
  if (raw === '') return undefined;
  if (!allowed.includes(raw)) {
    throw fail(
      [{ ref: name, reason: 'OUT_OF_RANGE' }],
      `${name} is not one of ${allowed.join(', ')}`,
    );
  }
  return raw;
};

// ---- the files behind the signed addresses ----

const SVG_COLORS = ['#5b8def', '#e0689a', '#47b881', '#f0a030', '#8a63d2', '#2ba3b5'];

function svgFor(name: string): Buffer {
  let sum = 0;
  for (const ch of name) sum = (sum * 31 + (ch.codePointAt(0) ?? 0)) % 9973;
  const color = SVG_COLORS[sum % SVG_COLORS.length];
  const label = name.replace(/\.[a-z]+$/, '').slice(0, 18);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
      `<rect width="240" height="240" fill="${color}"/><circle cx="120" cy="96" r="44" fill="#ffffff55"/>` +
      `<rect x="56" y="150" width="128" height="64" rx="32" fill="#ffffff55"/>` +
      `<text x="120" y="232" font-size="14" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${label.replace(/[<>&"]/g, '')}</text></svg>`,
  );
}

const PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n',
);

export default {
  // A file behind a signed address: no token, the signature is the permission (here: any name).
  'GET /api/admin/mock-files/:name': toUmiFile((req) => {
    const name = req.params.name ?? 'file.svg';
    if (name.endsWith('.pdf')) {
      return { file: { contentType: 'application/pdf', filename: name, body: PDF } };
    }
    return { file: { contentType: 'image/svg+xml', filename: name, body: svgFor(name) } };
  }),

  // ---- uploads (the body is a multipart form; the mock only hands out the id) ----
  'POST /api/admin/uploads/catalog-image': guard(['COSMETIC:MANAGE', 'ACTION:MANAGE'], () =>
    ok({ uploadId: newUpload(UPLOAD_KINDS['catalog-image']).id }),
  ),
  'POST /api/admin/uploads/renderer-model': guard('RENDERER:MANAGE', () =>
    ok({ uploadId: newUpload(UPLOAD_KINDS['renderer-model']).id }),
  ),
  'POST /api/admin/uploads/default-avatar-source': guard('DEFAULT_AVATAR:MANAGE', () =>
    ok({ uploadId: newUpload(UPLOAD_KINDS['default-avatar-source']).id }),
  ),

  // ---- cosmetics ----
  'GET /api/admin/cosmetics': guard(['COSMETIC:MANAGE', 'COSMETIC:GRANT'], (req) => {
    const kind = enumParam(req, 'kind', KINDS);
    const style = enumParam(req, 'style', STYLES);
    const enabled = boolParam(req, 'enabled');
    const rows = avatarState.cosmetics
      .filter(
        (c) =>
          (kind === undefined || c.kind === kind) &&
          (style === undefined || c.compatibleStyles.includes(style as 'REALISTIC')) &&
          (enabled === undefined || c.enabled === enabled),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || byIdAsc(a, b));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(cosmeticRow), total: page.total });
  }),

  'POST /api/admin/cosmetics': guard('COSMETIC:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const key = keyOf(body.key, details);
    if (typeof body.kind !== 'string' || !KINDS.includes(body.kind)) {
      details.push({ ref: 'kind', reason: 'OUT_OF_RANGE' });
    }
    const item = readCosmeticFields(body, details);
    if (body.enabled !== undefined) flag(body.enabled, 'enabled', details);
    if (details.length > 0) throw fail(details);
    if (avatarState.cosmetics.some((c) => c.key === key)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The key exists already', {
        field: 'key',
      });
    }
    const picture = uploadOf(body.previewUploadId, 'CATALOG_IMAGE', 'previewUploadId');
    picture.used = true;
    const created: MockCosmetic = {
      id: nextId(),
      key,
      kind: body.kind as MockCosmetic['kind'],
      ...item,
      previewFile: `${key}.svg`,
      enabled: body.enabled === true,
    };
    avatarState.cosmetics.push(created);
    clearOtherDefaults(created);
    return ok(cosmeticRow(created));
  }),

  'PUT /api/admin/cosmetics/:id': guard('COSMETIC:MANAGE', (req) => {
    const found = avatarState.cosmetics.find((c) => c.id === req.params.id);
    if (!found) throw notFound('cosmetic');
    const body = bodyOf(req);
    const details: Detail[] = [];
    const item = readCosmeticFields(body, details);
    if (details.length > 0) throw fail(details);
    if (body.previewUploadId !== undefined) {
      const picture = uploadOf(body.previewUploadId, 'CATALOG_IMAGE', 'previewUploadId');
      picture.used = true;
      found.previewFile = `${found.key}-${picture.id}.svg`;
    }
    Object.assign(found, item);
    clearOtherDefaults(found);
    return ok(cosmeticRow(found));
  }),

  'PUT /api/admin/cosmetics/:id/enabled': guard('COSMETIC:MANAGE', (req) => {
    const found = avatarState.cosmetics.find((c) => c.id === req.params.id);
    if (!found) throw notFound('cosmetic');
    const details: Detail[] = [];
    found.enabled = flag(bodyOf(req).enabled, 'enabled', details);
    if (details.length > 0) throw fail(details);
    return ok(cosmeticRow(found));
  }),

  // ---- actions ----
  'GET /api/admin/actions': guard('ACTION:MANAGE', (req) => {
    const rows = [...avatarState.actions].sort(
      (a, b) => a.sortOrder - b.sortOrder || byIdAsc(a, b),
    );
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(actionRow), total: page.total });
  }),

  'POST /api/admin/actions': guard('ACTION:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const key = keyOf(body.key, details);
    const item = readActionFields(body, details);
    if (body.enabled !== undefined) flag(body.enabled, 'enabled', details);
    if (details.length > 0) throw fail(details);
    if (avatarState.actions.some((a) => a.key === key)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The key exists already', {
        field: 'key',
      });
    }
    uploadOf(body.iconUploadId, 'CATALOG_IMAGE', 'iconUploadId').used = true;
    const created: MockAction = {
      id: nextId(),
      key,
      ...item,
      iconFile: `${key}.svg`,
      enabled: body.enabled === true,
      // A new action has no clip on any existing look.
      missingClips: 9,
    };
    avatarState.actions.push(created);
    return ok(actionRow(created));
  }),

  'PUT /api/admin/actions/:id': guard('ACTION:MANAGE', (req) => {
    const found = avatarState.actions.find((a) => a.id === req.params.id);
    if (!found) throw notFound('action');
    const body = bodyOf(req);
    const details: Detail[] = [];
    const item = readActionFields(body, details);
    if (details.length > 0) throw fail(details);
    if (body.iconUploadId !== undefined) {
      const picture = uploadOf(body.iconUploadId, 'CATALOG_IMAGE', 'iconUploadId');
      picture.used = true;
      found.iconFile = `${found.key}-${picture.id}.svg`;
    }
    Object.assign(found, item);
    return ok(actionRow(found));
  }),

  'PUT /api/admin/actions/:id/enabled': guard('ACTION:MANAGE', (req) => {
    const found = avatarState.actions.find((a) => a.id === req.params.id);
    if (!found) throw notFound('action');
    const details: Detail[] = [];
    found.enabled = flag(bodyOf(req).enabled, 'enabled', details);
    if (details.length > 0) throw fail(details);
    return ok(actionRow(found));
  }),

  // Queues the clips this action lacks; a second call finds nothing left to queue.
  'POST /api/admin/actions/:id/backfill': guard('ACTION:MANAGE', (req) => {
    const found = avatarState.actions.find((a) => a.id === req.params.id);
    if (!found) throw notFound('action');
    if (!found.enabled) throw invalidState('DISABLED', 'The action is disabled');
    const scheduled = found.missingClips;
    found.missingClips = 0;
    return ok({ scheduled });
  }),

  // ---- declarations ----
  'GET /api/admin/declarations': guard('DECLARATION:MANAGE', (req) => {
    const rows = [...avatarState.declarations].sort(
      (a, b) =>
        (b.activeFrom ?? '').localeCompare(a.activeFrom ?? '') ||
        a.version.localeCompare(b.version),
    );
    return ok(paginateQuery(rows, req));
  }),

  'POST /api/admin/declarations': guard('DECLARATION:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const version = typeof body.version === 'string' ? trimSpec(body.version) : '';
    if (version === '') details.push({ ref: 'version', reason: 'EMPTY_NOT_ALLOWED' });
    else if (countCodePoints(version) > 50) details.push({ ref: 'version', reason: 'TOO_LONG' });
    const texts = localized(body.texts, 'texts', details);
    if (details.length > 0) throw fail(details);
    if (avatarState.declarations.some((d) => d.version === version)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The version exists already', {
        field: 'version',
      });
    }
    const created = { version, texts, activeFrom: null, isActive: false };
    avatarState.declarations.push(created);
    return ok(created);
  }),

  'PUT /api/admin/declarations/:version/activate': guard('DECLARATION:MANAGE', (req) => {
    const found = avatarState.declarations.find((d) => d.version === req.params.version);
    if (!found) throw notFound('declaration version');
    for (const d of avatarState.declarations) d.isActive = false;
    found.isActive = true;
    found.activeFrom = new Date().toISOString();
    return ok(found);
  }),

  // ---- renderer models ----
  'GET /api/admin/renderer-models': guard('RENDERER:MANAGE', (req) => {
    const rows = [...avatarState.rendererModels].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return ok(paginateQuery(rows, req));
  }),

  'POST /api/admin/renderer-models': guard('RENDERER:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const word = (value: unknown, ref: string): string => {
      const trimmed = typeof value === 'string' ? trimSpec(value) : '';
      if (trimmed === '') details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
      return trimmed;
    };
    const rendererKind = word(body.rendererKind, 'rendererKind');
    const version = word(body.version, 'version');
    const abi = word(body.abi, 'abi');
    if (typeof body.platform !== 'string' || !PLATFORMS.includes(body.platform)) {
      details.push({ ref: 'platform', reason: 'OUT_OF_RANGE' });
    }
    const rendererFormatVersion = whole(
      body.rendererFormatVersion,
      'rendererFormatVersion',
      details,
      1,
    );
    const minVersionCode = whole(body.minVersionCode, 'minVersionCode', details, 0);
    if (details.length > 0) throw fail(details);
    const model = uploadOf(body.uploadId, 'RENDERER_MODEL', 'uploadId');
    if (
      avatarState.rendererModels.some(
        (m) =>
          m.rendererKind === rendererKind &&
          m.version === version &&
          m.platform === body.platform &&
          m.abi === abi,
      )
    ) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The model exists already', {
        field: 'version',
      });
    }
    model.used = true;
    // The size and the digest are the upload's, whatever the request says.
    const created = {
      id: nextId(),
      rendererKind,
      version,
      platform: body.platform as 'ANDROID' | 'IOS',
      abi,
      sha256: model.sha256,
      sizeBytes: model.sizeBytes,
      rendererFormatVersion,
      minVersionCode,
      enabled: false,
      createdAt: new Date().toISOString(),
    };
    avatarState.rendererModels.push(created);
    return ok(created);
  }),

  'PUT /api/admin/renderer-models/:id/enabled': guard('RENDERER:MANAGE', (req) => {
    const found = avatarState.rendererModels.find((m) => m.id === req.params.id);
    if (!found) throw notFound('renderer model');
    const details: Detail[] = [];
    found.enabled = flag(bodyOf(req).enabled, 'enabled', details);
    if (details.length > 0) throw fail(details);
    return ok(found);
  }),

  // ---- generation tasks ----
  'GET /api/admin/generation-tasks': guard('GENERATION:VIEW', (req) => {
    const status = enumParam(req, 'status', [
      'FAILED',
      'SUCCEEDED',
      'PROCESSING',
      'PENDING',
      'IN_REVIEW',
    ]);
    const type = enumParam(req, 'type', TASK_TYPES);
    const rows = avatarState.generationTasks
      .filter(
        (t) =>
          (status === undefined || t.status === status) && (type === undefined || t.type === type),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(paginateQuery(rows, req));
  }),

  // ---- default avatars ----
  'GET /api/admin/default-avatars': guard('DEFAULT_AVATAR:MANAGE', () => {
    settleGenerations();
    const rows = [...avatarState.defaultAvatars].sort((a, b) => b.createdAt - a.createdAt);
    return ok({ items: rows.map(defaultAvatarRow) });
  }),

  'POST /api/admin/default-avatars': guard('DEFAULT_AVATAR:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const { name, reason: nameReason } = nameProblem(body.name);
    if (nameReason) details.push({ ref: 'name', reason: nameReason });
    if (typeof body.style !== 'string' || !STYLES.includes(body.style)) {
      details.push({ ref: 'style', reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) throw fail(details);
    const source = uploadOf(body.sourceUploadId, 'DEFAULT_AVATAR_SOURCE', 'sourceUploadId');
    source.used = true;
    const created: MockDefaultAvatar = {
      id: `da-${nextId()}`,
      name,
      style: body.style as MockDefaultAvatar['style'],
      status: 'DRAFT',
      isActive: false,
      failureReason: null,
      lookId: null,
      sourceFile: `source-${source.id}.svg`,
      previewFile: null,
      startedAt: null,
      createdAt: Date.now(),
    };
    avatarState.defaultAvatars.push(created);
    return ok(defaultAvatarRow(created));
  }),

  'PUT /api/admin/default-avatars/:id': guard('DEFAULT_AVATAR:MANAGE', (req) => {
    const found = defaultAvatarOf(req);
    found.name = checkName(bodyOf(req).name);
    return ok(defaultAvatarRow(found));
  }),

  'POST /api/admin/default-avatars/:id/generate': guard('DEFAULT_AVATAR:MANAGE', (req) => {
    settleGenerations();
    const found = defaultAvatarOf(req);
    if (found.status !== 'DRAFT') {
      throw invalidState(found.status, 'Only a draft can be generated');
    }
    if (!avatarState.generationConfigured) {
      throw new MockHttpError(
        503,
        'GENERATION_NOT_CONFIGURED',
        'The generation has not been configured',
      );
    }
    found.status = 'GENERATING';
    found.failureReason = null;
    found.startedAt = Date.now();
    return ok(defaultAvatarRow(found));
  }),

  'POST /api/admin/default-avatars/:id/activate': guard('DEFAULT_AVATAR:MANAGE', (req) => {
    settleGenerations();
    const found = defaultAvatarOf(req);
    if (found.status !== 'READY')
      throw invalidState(found.status, 'Only a ready avatar can be activated');
    for (const d of avatarState.defaultAvatars) d.isActive = false;
    found.isActive = true;
    return ok(defaultAvatarRow(found));
  }),

  'DELETE /api/admin/default-avatars/:id': guard('DEFAULT_AVATAR:MANAGE', (req) => {
    settleGenerations();
    const found = defaultAvatarOf(req);
    if (found.isActive) throw invalidState(found.status, 'The active avatar cannot be deleted');
    if (found.status === 'GENERATING')
      throw invalidState(found.status, 'A running generation cannot be deleted');
    avatarState.defaultAvatars.splice(avatarState.defaultAvatars.indexOf(found), 1);
    return ok(null);
  }),

  // ---- an account's avatars (the user detail page) ----
  'GET /api/admin/accounts/:id/avatars': guard('USER:VIEW', (req) => {
    const id = req.params.id;
    const avatars = (avatarState.accountAvatars.get(id) ?? [])
      .map((a) => ({
        assetId: a.assetId,
        name: a.name,
        style: a.style,
        createdAt: a.createdAt,
        currentLookId: a.currentLookId,
        looks: a.looks.map(({ previewFile, ...look }) => ({
          ...look,
          previewUrl: signedUrl(previewFile),
        })),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      // The newest avatar is the one the account uses.
      .map((a, index) => ({ ...a, isCurrent: index === 0 }));
    // Looking at an account's avatars is audited, one row for each avatar shown (spec section 12,
    // "every view leaves an audit row"; the sample row of the audit page has the same shape).
    for (const avatar of avatars) {
      writeAudit(req.admin, 'USER_VIEW_AVATAR', 'AVATAR_ASSET', avatar.assetId, null);
    }
    return ok({ avatars, cosmetics: structuredClone(avatarState.accountCosmetics.get(id) ?? []) });
  }),

  'POST /api/admin/accounts/:id/cosmetics': guard('COSMETIC:GRANT', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const reason = typeof body.reason === 'string' ? trimSpec(body.reason) : '';
    const length = countCodePoints(reason);
    if (length === 0) details.push({ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' });
    else if (length > 500) details.push({ ref: 'reason', reason: 'TOO_LONG' });
    if (typeof body.itemId !== 'string' || body.itemId === '') {
      details.push({ ref: 'itemId', reason: 'EMPTY_NOT_ALLOWED' });
    }
    if (details.length > 0) throw fail(details);
    const item = avatarState.cosmetics.find((c) => c.id === body.itemId);
    if (!item) throw notFound('cosmetic');
    const owned = avatarState.accountCosmetics.get(req.params.id) ?? [];
    if (owned.some((o) => o.itemId === item.id)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The account owns the item already', {
        field: 'itemId',
      });
    }
    const row = {
      itemId: item.id,
      itemKey: item.key,
      source: 'ADMIN_GRANT' as const,
      creditLedgerId: null,
      grantedAt: new Date().toISOString(),
    };
    avatarState.accountCosmetics.set(req.params.id, [...owned, row]);
    return ok(row);
  }),
};

function defaultAvatarOf(req: MockReq): MockDefaultAvatar {
  const found = avatarState.defaultAvatars.find((d) => d.id === req.params.id);
  if (!found) throw notFound('default avatar');
  return found;
}

/** There is one default item of each kind: making this one the default takes it from the others. */
function clearOtherDefaults(item: MockCosmetic): void {
  if (!item.isDefault) return;
  for (const other of avatarState.cosmetics) {
    if (other !== item && other.kind === item.kind) other.isDefault = false;
  }
}

function readCosmeticFields(body: Record<string, unknown>, details: Detail[]) {
  const names = localized(body.names, 'names', details);
  const generationSpec = spec(body.generationSpec, 'generationSpec', details);
  const compatibleStyles = styles(body.compatibleStyles, details);
  const surfaceList = surfaces(body.surfaces, details);
  let creditPrice: number | null = null;
  if (body.creditPrice !== null && body.creditPrice !== undefined) {
    creditPrice = whole(body.creditPrice, 'creditPrice', details, 0);
  }
  const isFree = flag(body.isFree, 'isFree', details);
  const isDefault = flag(body.isDefault, 'isDefault', details);
  if (isDefault && !isFree) details.push({ ref: 'isDefault', reason: 'OUT_OF_RANGE' });
  const sortOrder = whole(body.sortOrder, 'sortOrder', details);
  return {
    names,
    generationSpec,
    compatibleStyles,
    surfaces: surfaceList,
    creditPrice,
    isFree,
    isDefault,
    sortOrder,
  };
}

function readActionFields(body: Record<string, unknown>, details: Detail[]) {
  const names = localized(body.names, 'names', details);
  const description = typeof body.description === 'string' ? trimSpec(body.description) : '';
  if (description === '') details.push({ ref: 'description', reason: 'EMPTY_NOT_ALLOWED' });
  const generationSpec = spec(body.generationSpec, 'generationSpec', details);
  const compatibleStyles = styles(body.compatibleStyles, details);
  const surfaceList = surfaces(body.surfaces, details);
  if (typeof body.triggerableBy !== 'string' || !TRIGGERS.includes(body.triggerableBy)) {
    details.push({ ref: 'triggerableBy', reason: 'OUT_OF_RANGE' });
  }
  const sortOrder = whole(body.sortOrder, 'sortOrder', details);
  return {
    names,
    description,
    generationSpec,
    compatibleStyles,
    surfaces: surfaceList,
    triggerableBy: body.triggerableBy as MockAction['triggerableBy'],
    sortOrder,
  };
}
