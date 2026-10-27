// The app version endpoints of the mock backend (contract 24.1, 24.2): the versions of the channels,
// the APK upload, activation and taking down. State lives in _core/appVersionsData.ts and the
// channels in _core/channelsData.ts. The reasons of a refused field (`details[].reason`) are the
// codes of the language files; what the contract leaves open follows
// docs/contract-requests/2026-10-26-admin-frontend-app-versions.md.

import { validateStoreUrl } from '../src/pages/appVersions/storeUrl';
import {
  checkChangelog,
  checkMinVersionCode,
  checkVersionCode,
  checkVersionName,
  cleanChangelog,
} from '../src/pages/appVersions/versionRules';
import { PLATFORMS, VERSION_STATUSES } from '../src/services/appVersions/types';
import { trimSpec } from '../src/utils/trimSpec';
import {
  appVersionsState,
  type MockApkUpload,
  type MockVersion,
  makeApkUpload,
} from './_core/appVersionsData';
import { guard } from './_core/auth';
import { channelsState, type MockChannel } from './_core/channelsData';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { store } from './_core/store';

type Detail = { ref: string; reason: string };
const refuse = (details: Detail[]): never => {
  throw invalidRequest(`invalid: ${details.map((d) => d.ref).join(', ')}`, details);
};
const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `The ${what} is not there`);
const invalidState = (status: string, message: string) =>
  new MockHttpError(409, 'INVALID_STATE', message, { status });

const usernameOf = (id: string | null): string | null =>
  id === null ? null : (store.admins.get(id)?.username ?? null);

/** The row as the backend answers it: an administrator id comes with its name beside it. */
const view = (v: MockVersion): MockVersion => ({
  ...structuredClone(v),
  createdByUsername: usernameOf(v.createdBy),
  activatedByUsername: usernameOf(v.activatedBy),
});

const versionOf = (id: string): MockVersion => {
  const found = appVersionsState.versions.get(id);
  if (!found) throw notFound('version');
  return found;
};

const activeIn = (channelCode: string): MockVersion | undefined =>
  [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === channelCode && v.status === 'ACTIVE',
  );

const channelOf = (code: unknown): MockChannel | undefined =>
  typeof code === 'string' ? channelsState.channels.get(code) : undefined;

/** The upload a DIRECT version names: it has to be there, be an APK and be free (or be the one this version holds). */
function uploadFor(id: string, holder: MockVersion | null): MockApkUpload {
  const upload = appVersionsState.uploads.get(id);
  if (!upload) throw notFound('upload');
  if (upload.kind !== 'APK') refuse([{ ref: 'apkUploadId', reason: 'OUT_OF_RANGE' }]);
  if (upload.used && holder?.apkUploadId !== id) {
    throw invalidState('USED', 'The upload belongs to another object already');
  }
  return upload;
}

type Checked = {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  changelog: Record<string, string>;
  storeUrl: string | null;
  apkUploadId: string | null;
};

/**
 * The checks of contract 24.2 that need no stored object but the channel. `own` is the draft being
 * edited (its own number is not a duplicate).
 */
function check(
  channel: MockChannel,
  body: Record<string, unknown>,
  own: MockVersion | null,
): Checked {
  const details: Detail[] = [];
  const versionName = typeof body.versionName === 'string' ? trimSpec(body.versionName) : '';
  if (!checkVersionName(versionName).ok)
    details.push({ ref: 'versionName', reason: 'INVALID_PATTERN' });
  const active = activeIn(channel.code);
  if (!checkVersionCode(body.versionCode, active?.versionCode ?? null).ok) {
    details.push({ ref: 'versionCode', reason: 'OUT_OF_RANGE' });
  }
  const code = typeof body.versionCode === 'number' ? body.versionCode : null;
  if (!checkMinVersionCode(body.minVersionCode, code).ok) {
    details.push({ ref: 'minVersionCode', reason: 'OUT_OF_RANGE' });
  }
  const raw = body.changelog;
  const texts =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? cleanChangelog(raw as Record<string, string>)
      : {};
  if (!checkChangelog(texts).ok) details.push({ ref: 'changelog', reason: 'EMPTY_NOT_ALLOWED' });

  const storeUrl = typeof body.storeUrl === 'string' ? trimSpec(body.storeUrl) : '';
  const apkUploadId = typeof body.apkUploadId === 'string' ? body.apkUploadId : '';
  if (channel.distribution === 'STORE') {
    if (
      storeUrl === '' ||
      !validateStoreUrl(channel.platform, storeUrl, channel.packageName ?? undefined).ok
    ) {
      details.push({ ref: 'storeUrl', reason: 'INVALID_PATTERN' });
    }
    if (apkUploadId !== '') details.push({ ref: 'apkUploadId', reason: 'OUT_OF_RANGE' });
  } else {
    if (storeUrl !== '') details.push({ ref: 'storeUrl', reason: 'OUT_OF_RANGE' });
    if (apkUploadId === '') details.push({ ref: 'apkUploadId', reason: 'EMPTY_NOT_ALLOWED' });
  }
  if (details.length > 0) refuse(details);

  const same = [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === channel.code && v.versionCode === code && v.id !== own?.id,
  );
  if (same) {
    throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The version number exists in the channel', {
      field: 'versionCode',
    });
  }
  return {
    versionName,
    versionCode: code as number,
    minVersionCode: body.minVersionCode as number,
    changelog: texts,
    storeUrl: channel.distribution === 'STORE' ? storeUrl : null,
    apkUploadId: channel.distribution === 'DIRECT' ? apkUploadId : null,
  };
}

function applyFile(version: MockVersion, upload: MockApkUpload | null): void {
  version.apkUploadId = upload?.id ?? null;
  version.apkUrl = upload?.apkUrl ?? null;
  version.apkSizeBytes = upload?.apkSizeBytes ?? null;
  version.apkSha256 = upload?.apkSha256 ?? null;
}

const newId = (): string => `ver-${String(appVersionsState.next.version++).padStart(4, '0')}`;

export default {
  'GET /api/admin/app-versions': guard('APPVERSION:VIEW', (req) => {
    const { channelCode, platform, status } = req.query as Record<string, string | undefined>;
    const details: Detail[] = [];
    if (
      platform !== undefined &&
      platform !== '' &&
      !(PLATFORMS as readonly string[]).includes(platform)
    ) {
      details.push({ ref: 'platform', reason: 'OUT_OF_RANGE' });
    }
    if (
      status !== undefined &&
      status !== '' &&
      !(VERSION_STATUSES as readonly string[]).includes(status)
    ) {
      details.push({ ref: 'status', reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) refuse(details);
    const rows = [...appVersionsState.versions.values()]
      .filter((v) => !channelCode || v.channelCode === channelCode)
      .filter((v) => !platform || v.platform === platform)
      .filter((v) => !status || v.status === status)
      // the active ones first, the rest newest first
      .sort((a, b) => {
        if ((a.status === 'ACTIVE') !== (b.status === 'ACTIVE'))
          return a.status === 'ACTIVE' ? -1 : 1;
        return a.createdAt < b.createdAt
          ? 1
          : a.createdAt > b.createdAt
            ? -1
            : b.id.localeCompare(a.id);
      });
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(view), total: page.total });
  }),

  'GET /api/admin/app-versions/:id': guard('APPVERSION:VIEW', (req) =>
    ok(view(versionOf(req.params.id))),
  ),

  'POST /api/admin/app-versions': guard('APPVERSION:MANAGE', (req) => {
    const body = bodyOf(req);
    const channel = channelOf(body.channelCode);
    if (!channel) refuse([{ ref: 'channelCode', reason: 'OUT_OF_RANGE' }]);
    const target = channel as MockChannel;
    if (!target.enabled) throw invalidState('DISABLED', 'The channel is off');
    const fields = check(target, body, null);
    const upload = fields.apkUploadId === null ? null : uploadFor(fields.apkUploadId, null);
    const now = new Date().toISOString();
    const version: MockVersion = {
      id: newId(),
      channelCode: target.code,
      platform: target.platform,
      versionName: fields.versionName,
      versionCode: fields.versionCode,
      minVersionCode: fields.minVersionCode,
      storeUrl: fields.storeUrl,
      apkUploadId: null,
      apkUrl: null,
      apkSizeBytes: null,
      apkSha256: null,
      changelog: fields.changelog,
      status: 'DRAFT',
      createdBy: req.admin.id,
      createdByUsername: null,
      activatedBy: null,
      activatedByUsername: null,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    applyFile(version, upload);
    if (upload) upload.used = true;
    appVersionsState.versions.set(version.id, version);
    return ok(view(version));
  }),

  'PUT /api/admin/app-versions/:id': guard('APPVERSION:MANAGE', (req) => {
    const version = versionOf(req.params.id);
    if (version.status !== 'DRAFT')
      throw invalidState(version.status, 'Only a draft can be edited');
    const body = bodyOf(req);
    if ('channelCode' in body && body.channelCode !== version.channelCode) {
      refuse([{ ref: 'channelCode', reason: 'OUT_OF_RANGE' }]);
    }
    const channel = channelsState.channels.get(version.channelCode) as MockChannel;
    const fields = check(channel, body, version);
    const upload = fields.apkUploadId === null ? null : uploadFor(fields.apkUploadId, version);
    const old = version.apkUploadId;
    version.versionName = fields.versionName;
    version.versionCode = fields.versionCode;
    version.minVersionCode = fields.minVersionCode;
    version.changelog = fields.changelog;
    version.storeUrl = fields.storeUrl;
    if (upload && upload.id !== old) {
      upload.used = true;
      // the file the draft had is gone with its record
      if (old) appVersionsState.uploads.delete(old);
      applyFile(version, upload);
    }
    version.updatedAt = new Date().toISOString();
    return ok(view(version));
  }),

  'PUT /api/admin/app-versions/:id/status': guard('APPVERSION:ACTIVATE', (req) => {
    const version = versionOf(req.params.id);
    const body = bodyOf(req);
    if (body.status !== 'ACTIVE' && body.status !== 'ARCHIVED') {
      refuse([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    }
    const channel = channelsState.channels.get(version.channelCode) as MockChannel;
    const now = new Date().toISOString();
    if (body.status === 'ARCHIVED') {
      if (version.status !== 'ACTIVE')
        throw invalidState(version.status, 'Only the active version can be taken down');
      version.status = 'ARCHIVED';
      version.updatedAt = now;
      return ok(view(version));
    }
    if (version.status !== 'DRAFT')
      throw invalidState(version.status, 'Only a draft can be activated');
    if (!channel.enabled) throw invalidState('DISABLED', 'The channel is off');
    if (channel.distribution === 'STORE' && body.confirmStoreLive !== true) {
      refuse([{ ref: 'confirmStoreLive', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    const active = activeIn(version.channelCode);
    if (!checkVersionCode(version.versionCode, active?.versionCode ?? null).ok) {
      refuse([{ ref: 'versionCode', reason: 'OUT_OF_RANGE' }]);
    }
    if (active) {
      active.status = 'ARCHIVED';
      active.updatedAt = now;
    }
    version.status = 'ACTIVE';
    version.activatedBy = req.admin.id;
    version.activatedAt = now;
    version.updatedAt = now;
    return ok(view(version));
  }),

  'DELETE /api/admin/app-versions/:id': guard('APPVERSION:MANAGE', (req) => {
    const version = versionOf(req.params.id);
    if (version.status !== 'DRAFT')
      throw invalidState(version.status, 'Only a draft can be deleted');
    // the file of a draft goes with it
    if (version.apkUploadId) appVersionsState.uploads.delete(version.apkUploadId);
    appVersionsState.versions.delete(version.id);
    return ok(null);
  }),

  'POST /api/admin/uploads/apk': guard('APPVERSION:MANAGE', () => {
    if (!appVersionsState.apkAvailable) {
      throw new MockHttpError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'upload.public_base_url is not configured',
      );
    }
    if (appVersionsState.nextApkRefusal) {
      appVersionsState.nextApkRefusal = false;
      throw new MockHttpError(400, 'INVALID_FILE', 'The file has no v2 or later signature');
    }
    const id = `up-${String(appVersionsState.next.upload++).padStart(6, '0')}`;
    const upload = makeApkUpload(id, false);
    appVersionsState.uploads.set(id, upload);
    return ok({
      uploadId: id,
      apkUrl: upload.apkUrl,
      apkSizeBytes: upload.apkSizeBytes,
      apkSha256: upload.apkSha256,
    });
  }),
};
