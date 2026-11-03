// The app version endpoints of the mock backend (contract 24.1, 24.2): the versions of the channels,
// the APK upload, activation and taking down. State lives in _core/appVersionsData.ts and the
// channels in _core/channelsData.ts. The reasons of a refused field (`details[].reason`) are the
// codes of the language files; what the contract leaves open follows
// docs/contract-requests/2026-10-26-admin-frontend-app-versions.md.

import { validateStoreUrl } from '../src/pages/appVersions/storeUrl';
import {
  checkMinVersionCode,
  checkVersionCode,
  checkVersionName,
  cleanChangelog,
  highestLiveCode,
  highestOtherCode,
  MAX_CODE,
} from '../src/pages/appVersions/versionRules';
import { PLATFORMS, VERSION_STATUSES } from '../src/services/appVersions/types';
import { countCodePoints } from '../src/utils/codePoints';
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
import { currentMeta } from './_core/meta';
import { paginateQuery } from './_core/paginate';
import { store } from './_core/store';

type Detail = { ref: string; reason: string };
const refuse = (details: Detail[]): never => {
  throw invalidRequest(`invalid: ${details.map((d) => d.ref).join(', ')}`, details);
};
const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `The ${what} is not there`);
/**
 * 409 INVALID_STATE of the version endpoints (contract 24.2 and 24.7): `data.status` is the current
 * state of the version (DRAFT, ACTIVE, ARCHIVED), or DISABLED when the channel is off; a used upload
 * is CONSUMED (below).
 */
const invalidState = (status: string, message: string) =>
  new MockHttpError(409, 'INVALID_STATE', message, { status });
const channelOff = () => invalidState('DISABLED', 'The channel is off');
const uploadConsumed = () =>
  new MockHttpError(409, 'INVALID_STATE', 'Upload is already used', { status: 'CONSUMED' });

/** The language key of the notes (answers 91) and the limits of the notes. */
const NOTE_KEY = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const NOTE_KEY_MAX = 35;
const NOTE_LANGUAGES_MAX = 30;
const NOTE_MAX = 4000;
const malformed = () =>
  new MockHttpError(400, 'INVALID_REQUEST', 'Malformed or invalid request body');

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

/** The upload a DIRECT version names: it has to be there and be an APK. Whether it is free comes later (`assertFree`). */
function uploadFor(id: string): MockApkUpload {
  const upload = appVersionsState.uploads.get(id);
  if (!upload) throw notFound('upload');
  if (upload.kind !== 'APK') refuse([{ ref: 'apkUploadId', reason: 'OUT_OF_RANGE' }]);
  return upload;
}

/** The upload has to be free, or be the one this version holds (409 CONSUMED: the last check of a save). */
function assertFree(upload: MockApkUpload, holder: MockVersion | null): void {
  if (upload.used && holder?.apkUploadId !== upload.id) throw uploadConsumed();
}

/**
 * The package name a Google Play link is checked against: the backend's environment value, which
 * `GET /meta` gives as googlePlayPackageName, not the package registered on the channel.
 */
function googlePlayPackage(): string | undefined {
  const name = currentMeta().googlePlayPackageName;
  return typeof name === 'string' && name !== '' ? name : undefined;
}

/** The reason code (contract 1.7 and 24.2) of a store link the page's own check refuses. */
function storeUrlReason(reasonKey: string): string {
  const own = /^reason\.([A-Z_]+)$/.exec(reasonKey);
  if (own) return own[1];
  if (/Host$/.test(reasonKey)) return 'INVALID_HOST';
  if (/port$/.test(reasonKey)) return 'INVALID_PORT';
  if (/Path$/.test(reasonKey)) return 'INVALID_PATH';
  return 'OUT_OF_RANGE';
}

type Checked = {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  changelog: Record<string, string>;
  storeUrl: string | null;
  apkUploadId: string | null;
};

/** The versions of a channel, as the number checks look at them. */
const versionsOf = (channelCode: string): MockVersion[] =>
  [...appVersionsState.versions.values()].filter((v) => v.channelCode === channelCode);

/**
 * The number checks of a save, in the backend's order (answers 47): the number the channel has
 * already is 409 `DUPLICATE_RESOURCE` naming the field; then, when the number is new or changed
 * (a draft whose number is left alone is not compared), a number that does not beat every other
 * version of the channel, drafts and taken-down ones included, is 400 `INVALID_REQUEST` with a
 * message and no field list. `own` is the draft being edited.
 */
function checkNumber(channel: MockChannel, code: number, own: MockVersion | null): void {
  const others = versionsOf(channel.code).filter((v) => v.id !== own?.id);
  if (others.some((v) => v.versionCode === code)) {
    throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The version number exists in the channel', {
      field: 'versionCode',
    });
  }
  if (own !== null && own.versionCode === code) return;
  const highest = highestOtherCode(others, null);
  if (!checkVersionCode(code, highest).ok) {
    throw invalidRequest(
      `versionCode must be higher than ${highest}, the highest version number of the other versions of the channel`,
      [{ ref: 'versionCode', reason: 'OUT_OF_RANGE' }],
    );
  }
}

/**
 * The checks of contract 24.2 that need no stored object but the channel: the shape of every
 * field (the numbers are compared with the other versions later, by `checkNumber`).
 */
function check(channel: MockChannel, body: Record<string, unknown>): Checked {
  // A number beyond 32 bits cannot be read into the field: a malformed body (not run against the backend).
  for (const field of ['versionCode', 'minVersionCode'] as const) {
    const value = body[field];
    if (typeof value === 'number' && Number.isInteger(value) && value > MAX_CODE) throw malformed();
  }
  const details: Detail[] = [];
  const versionName = typeof body.versionName === 'string' ? trimSpec(body.versionName) : '';
  if (!checkVersionName(versionName).ok) {
    details.push({
      ref: 'versionName',
      reason: versionName === '' ? 'EMPTY_NOT_ALLOWED' : 'INVALID_FORMAT',
    });
  }
  if (!checkVersionCode(body.versionCode, null).ok) {
    details.push({ ref: 'versionCode', reason: 'OUT_OF_RANGE' });
  }
  const code = typeof body.versionCode === 'number' ? body.versionCode : null;
  if (!checkMinVersionCode(body.minVersionCode, code).ok) {
    details.push({ ref: 'minVersionCode', reason: 'OUT_OF_RANGE' });
  }
  const raw = body.changelog;
  const isNotes = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  if (!isNotes && raw !== undefined && raw !== null) {
    details.push({ ref: 'changelog', reason: 'INVALID_FORMAT' });
  } else if (isNotes) {
    const entries = Object.entries(raw as Record<string, unknown>);
    // every fault of the notes names `changelog.<language key>` (a fault of the whole map, `changelog`)
    for (const [tag, text] of entries) {
      const ref = `changelog.${tag}`;
      if (!NOTE_KEY.test(tag) || tag.length > NOTE_KEY_MAX) {
        details.push({ ref, reason: 'INVALID_LANGUAGE_TAG' });
      } else if (typeof text !== 'string') {
        details.push({ ref, reason: 'INVALID_FORMAT' });
      } else if (trimSpec(text) === '') {
        details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
      } else if (countCodePoints(trimSpec(text)) > NOTE_MAX) {
        details.push({ ref, reason: 'OUT_OF_RANGE' });
      }
    }
    if (entries.length > NOTE_LANGUAGES_MAX)
      details.push({ ref: 'changelog', reason: 'OUT_OF_RANGE' });
  }
  const texts = isNotes ? cleanChangelog(raw as Record<string, string>) : {};
  if (typeof texts.en !== 'string' && !details.some((d) => d.ref.startsWith('changelog'))) {
    details.push({ ref: 'changelog', reason: 'EMPTY_NOT_ALLOWED' });
  }

  const storeUrl = typeof body.storeUrl === 'string' ? trimSpec(body.storeUrl) : '';
  const apkUploadId = typeof body.apkUploadId === 'string' ? body.apkUploadId : '';
  if (channel.distribution === 'STORE') {
    const link =
      storeUrl === '' ? null : validateStoreUrl(channel.platform, storeUrl, googlePlayPackage());
    if (storeUrl === '') details.push({ ref: 'storeUrl', reason: 'EMPTY_NOT_ALLOWED' });
    else if (link && !link.ok)
      details.push({ ref: 'storeUrl', reason: storeUrlReason(link.reasonKey) });
    if (apkUploadId !== '') details.push({ ref: 'apkUploadId', reason: 'OUT_OF_RANGE' });
  } else {
    if (storeUrl !== '') details.push({ ref: 'storeUrl', reason: 'OUT_OF_RANGE' });
    if (apkUploadId === '') details.push({ ref: 'apkUploadId', reason: 'EMPTY_NOT_ALLOWED' });
  }
  if (details.length > 0) refuse(details);

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
    const fields = check(target, body);
    const upload = fields.apkUploadId === null ? null : uploadFor(fields.apkUploadId);
    // answers 47: the numbers, then whether the channel is on, then whether the upload is free
    checkNumber(target, fields.versionCode, null);
    if (!target.enabled) throw channelOff();
    if (upload) assertFree(upload, null);
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
    const fields = check(channel, body);
    const upload = fields.apkUploadId === null ? null : uploadFor(fields.apkUploadId);
    checkNumber(channel, fields.versionCode, version);
    if (upload) assertFree(upload, version);
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
    // answers 47: the state, the store confirmation, the number, and last whether the channel is on
    if (channel.distribution === 'STORE' && body.confirmStoreLive !== true) {
      refuse([{ ref: 'confirmStoreLive', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    // contract 24.2: an activation has to beat every version of the channel that has been live
    const live = highestLiveCode(
      versionsOf(version.channelCode).filter((v) => v.id !== version.id),
    );
    if (!checkVersionCode(version.versionCode, live).ok) {
      throw invalidRequest(
        `versionCode must be higher than ${live}, the highest version number of the versions of the channel that have been active`,
        [{ ref: 'versionCode', reason: 'OUT_OF_RANGE' }],
      );
    }
    if (!channel.enabled) throw channelOff();
    // The checks of the stored APK of a DIRECT channel (missing, size, SHA-256) answer a message only.
    if (channel.distribution === 'DIRECT' && appVersionsState.storedFileFault) {
      throw new MockHttpError(
        400,
        'INVALID_REQUEST',
        'The stored APK file does not match its record',
      );
    }
    const active = activeIn(version.channelCode);
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
