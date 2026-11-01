// The in-app ad endpoints of the mock backend (contract 22.9 and 22.4 to 22.5; the report rows are
// those of the backend's reply, item 18). State lives in _core/adsData.ts and the numbers of the
// reports in _core/adsReport.ts. What the contract leaves open (the body of a status change, of a
// review, what a refused upload is called) follows
// docs/contract-requests/2026-10-26-admin-frontend-ads.md. The export and the landing of the report
// are in export.mock.ts and stats.mock.ts.

import type { PermissionCode } from '../src/access/permissionCodes';
import {
  CAMPAIGN_STATUSES,
  type CampaignStatus,
  CLICK_ACTIONS,
  CREATIVE_TYPES,
  REVIEW_STATUSES,
  SERVING_STATUSES,
  UNIT_STATUSES,
} from '../src/services/ads/types';
import { countCodePoints } from '../src/utils/codePoints';
import { validateServerLink } from '../src/utils/linkRule';
import { SCREEN_TARGETS } from '../src/utils/screenTargets';
import { trimSpec } from '../src/utils/trimSpec';
import {
  adsState,
  MEDIA_SAMPLES,
  type MockCampaign,
  type MockCreative,
  type MockPlacement,
  type MockUnit,
  type MockUpload,
  mediaUrlOf,
  thumbnailUrlOf,
  usernameOf,
} from './_core/adsData';
import {
  add,
  COUNTRIES,
  type CountRow,
  emptyCounts,
  type Filter,
  leaf,
  noFillRows,
  withRatios,
} from './_core/adsReport';
import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { daysIn, rangeOf, text } from './_core/statRange';

type Detail = { ref: string; reason: string };

const CAMPAIGN_READ: PermissionCode[] = ['ADS:CAMPAIGN', 'ADS:UNIT', 'ADS:CREATIVE'];
const PLACEMENT_READ: PermissionCode[] = ['ADS:PLACEMENT', 'ADS:UNIT'];
const UNIT_READ: PermissionCode[] = ['ADS:UNIT', 'ADS:CREATIVE'];
const ANY_ADS: PermissionCode[] = [
  'ADS:CAMPAIGN',
  'ADS:PLACEMENT',
  'ADS:UNIT',
  'ADS:CREATIVE',
  'ADS:REPORT',
];

const fail = (details: Detail[], message = 'invalid request') => invalidRequest(message, details);
const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const invalidState = (status: string, message: string) =>
  new MockHttpError(409, 'INVALID_STATE', message, { status });
const throwIf = (details: Detail[]) => {
  if (details.length > 0) throw fail(details);
};

const isText = (value: unknown): value is string => typeof value === 'string';
const idOf = (req: { params: Record<string, string> }) => req.params.id;
const newest = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => Number(b.id) - Number(a.id));
const nowIso = () => new Date().toISOString();

/** A whole number in `[min, max]`; a value that is not a whole number or is outside is put into the details. */
function whole(
  value: unknown,
  ref: string,
  details: Detail[],
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    details.push({ ref, reason: 'NOT_AN_INTEGER' });
    return undefined;
  }
  if (value < min || value > max) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return undefined;
  }
  return value;
}

/** Text trimmed with the contract's set; the empty text is `null`. */
const optionalText = (value: unknown, ref: string, details: Detail[]): string | null => {
  if (value === undefined || value === null) return null;
  if (!isText(value)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return null;
  }
  const trimmed = trimSpec(value);
  return trimmed === '' ? null : trimmed;
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const instantOrNull = (value: unknown, ref: string, details: Detail[]): string | null => {
  if (value === null || value === undefined) return null;
  if (!isText(value) || !ISO_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return null;
  }
  return value;
};

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  ref: string,
  details: Detail[],
): T | undefined => {
  if (isText(value) && (allowed as readonly string[]).includes(value)) return value as T;
  details.push({ ref, reason: 'OUT_OF_RANGE' });
  return undefined;
};

/** A filter of a list: absent is no filter, a value outside the set is 400. */
const filterOf = <T extends string>(
  req: { query: Record<string, unknown> },
  name: string,
  allowed: readonly T[],
): T | undefined => {
  const value = text(req.query[name]);
  if (value === '') return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw fail(
      [{ ref: name, reason: 'OUT_OF_RANGE' }],
      `${name} is not one of ${allowed.join(', ')}`,
    );
  }
  return value as T;
};

const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

// ---- the shapes of the answers ----

const campaignRow = (c: MockCampaign) => ({
  ...c,
  createdByUsername: usernameOf(c.createdBy),
  updatedByUsername: usernameOf(c.updatedBy),
});

const placementRow = (p: MockPlacement) => ({ ...p });

const unitRow = (u: MockUnit) => ({
  ...u,
  createdByUsername: usernameOf(u.createdBy),
  updatedByUsername: usernameOf(u.updatedBy),
});

const creativeRow = (c: MockCreative) => {
  const upload = adsState.uploads.get(c.uploadId);
  return {
    ...c,
    type: upload?.mediaType ?? 'IMAGE',
    mediaUrl: upload ? mediaUrlOf(upload) : null,
    thumbnailUrl: upload ? thumbnailUrlOf(upload) : null,
    width: upload?.width ?? null,
    height: upload?.height ?? null,
    bytes: upload?.bytes ?? null,
    durationSeconds: upload?.durationSeconds ?? null,
    createdByUsername: usernameOf(c.createdBy),
    reviewedByUsername: usernameOf(c.reviewedBy),
  };
};

// ---- the campaigns ----

function campaignFields(body: Record<string, unknown>, current: MockCampaign | null) {
  const details: Detail[] = [];
  const has = (key: string) => current === null || key in body;
  const out: Partial<MockCampaign> = {};
  if (has('name')) {
    const name = isText(body.name) ? trimSpec(body.name) : '';
    if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
    else out.name = name;
  }
  if (has('description')) out.description = optionalText(body.description, 'description', details);
  if (has('priority')) {
    out.priority =
      body.priority === undefined ? 100 : whole(body.priority, 'priority', details, 0, 100000);
  }
  if (has('startAt')) out.startAt = instantOrNull(body.startAt, 'startAt', details);
  if (has('endAt')) out.endAt = instantOrNull(body.endAt, 'endAt', details);
  const startAt = 'startAt' in out ? out.startAt : (current?.startAt ?? null);
  const endAt = 'endAt' in out ? out.endAt : (current?.endAt ?? null);
  if (
    details.every((d) => d.ref !== 'startAt' && d.ref !== 'endAt') &&
    startAt &&
    endAt &&
    Date.parse(endAt) < Date.parse(startAt)
  ) {
    details.push({ ref: 'endAt', reason: 'OUT_OF_RANGE' });
  }
  throwIf(details);
  return out;
}

const NEXT_STATUS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ['ACTIVE', 'ENDED'],
  ACTIVE: ['PAUSED', 'ENDED'],
  PAUSED: ['ACTIVE', 'ENDED'],
  ENDED: [],
};

const campaignOf = (id: string): MockCampaign => {
  const found = adsState.campaigns.get(id);
  if (!found) throw notFound('campaign');
  return found;
};

// ---- the targeting (contract 22.5) ----

const TARGETING_KEYS = [
  'platforms',
  'geo',
  'os_version_min',
  'app_version_min',
  'languages',
  'day_parts',
] as const;
const VERSION = /^\d+(\.\d+)*$/;
const COUNTRY = /^[A-Z]{2}$/;
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;

function checkTargeting(value: unknown, details: Detail[]): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    details.push({ ref: 'targeting', reason: 'OUT_OF_RANGE' });
    return;
  }
  const targeting = value as Record<string, unknown>;
  for (const key of Object.keys(targeting)) {
    if (!(TARGETING_KEYS as readonly string[]).includes(key)) {
      details.push({ ref: `targeting.${key}`, reason: 'OUT_OF_RANGE' });
    }
  }
  const list = (key: string) =>
    Array.isArray(targeting[key]) ? (targeting[key] as unknown[]) : null;
  const ref = (key: string) => `targeting.${key}`;
  if ('platforms' in targeting) {
    const platforms = list('platforms');
    if (!platforms?.every((p) => p === 'ANDROID' || p === 'IOS')) {
      details.push({ ref: ref('platforms'), reason: 'OUT_OF_RANGE' });
    }
  }
  if ('geo' in targeting) {
    const geo = list('geo');
    if (!geo?.every((c) => isText(c) && COUNTRY.test(c))) {
      details.push({ ref: ref('geo'), reason: 'OUT_OF_RANGE' });
    }
  }
  for (const key of ['os_version_min', 'app_version_min'] as const) {
    if (key in targeting && !(isText(targeting[key]) && VERSION.test(targeting[key] as string))) {
      details.push({ ref: ref(key), reason: 'OUT_OF_RANGE' });
    }
  }
  if ('languages' in targeting) {
    const languages = list('languages');
    if (!languages?.every((l) => isText(l) && LANGUAGE_TAG.test(l) && l.length <= 35)) {
      details.push({ ref: ref('languages'), reason: 'INVALID_LANGUAGE_TAG' });
    }
  }
  if ('day_parts' in targeting) {
    const parts = list('day_parts');
    const fine = parts?.every((part) => {
      const p = part as { start?: unknown; end?: unknown } | null;
      return (
        typeof p === 'object' &&
        p !== null &&
        isText(p.start) &&
        isText(p.end) &&
        CLOCK.test(p.start) &&
        CLOCK.test(p.end)
      );
    });
    if (!fine) details.push({ ref: ref('day_parts'), reason: 'OUT_OF_RANGE' });
  }
}

/** The targeting after a Merge Patch: a key sent as `null` is removed, the others replace. */
function mergeTargeting(current: Record<string, unknown>, patch: unknown): Record<string, unknown> {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return patch as never;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

const withoutNulls = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null));

// ---- the placements ----

const placementOf = (id: string): MockPlacement => {
  const found = adsState.placements.get(id);
  if (!found) throw notFound('placement');
  return found;
};

// ---- the units ----

const unitOf = (id: string): MockUnit => {
  const found = adsState.units.get(id);
  if (!found) throw notFound('unit');
  return found;
};

const UNIT_NEXT: Record<MockUnit['status'], readonly MockUnit['status'][]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED'],
  PAUSED: ['ACTIVE'],
};

const creativesOfUnit = (unitId: string) =>
  [...adsState.creatives.values()].filter((c) => c.adUnitId === unitId);

// ---- the uploads and the creatives ----

function uploadOf(id: string): MockUpload {
  const upload = adsState.uploads.get(id);
  if (!upload) throw notFound('upload');
  if (upload.kind !== 'AD_MEDIA') {
    throw fail([{ ref: 'uploadId', reason: 'OUT_OF_RANGE' }], 'The upload is of another kind');
  }
  if (upload.used) throw invalidState('USED', 'The upload belongs to another object already');
  return upload;
}

const toleranceOf = (): number => {
  const value = currentValue('ads.creative_aspect_tolerance_percent');
  return typeof value === 'number' ? value : 3;
};

/** The file against the spec of the placement: the ratio within the tolerance, the shorter side, the size. */
function checkSpec(upload: MockUpload, placement: MockPlacement, details: Detail[]): void {
  const [w, h] = placement.creativeAspect.split(':').map(Number);
  const target = w / h;
  const actual = upload.width / upload.height;
  const tooLarge = upload.bytes > placement.creativeMaxBytes;
  const tooSmall = Math.min(upload.width, upload.height) < placement.creativeMinShortSide;
  const offRatio = Math.abs(actual - target) / target > toleranceOf() / 100;
  if (tooLarge || tooSmall || offRatio) details.push({ ref: 'uploadId', reason: 'OUT_OF_RANGE' });
}

const FULL_SCREEN = ['SPLASH', 'INTERSTITIAL'];

function warningsFor(creative: MockCreative, placement: MockPlacement) {
  const warnings: { code: string; message: string }[] = [];
  if (!creative.skippable && FULL_SCREEN.includes(placement.adFormat)) {
    warnings.push({
      code: 'AD_NOT_SKIPPABLE',
      message: 'A full-screen ad should be easy to close',
    });
  }
  const skipAfter = currentValue('ads.skip_after_seconds');
  if (typeof skipAfter === 'number' && skipAfter > 5) {
    warnings.push({
      code: 'AD_SKIP_AFTER_TOO_LONG',
      message: 'A long skip delay can break store rules',
    });
  }
  return warnings;
}

/**
 * The fields of a creative from a request. On create every field is read (with its default); on
 * update only the ones that are in the body. `upload` is the file the creative will have.
 */
function creativeFields(
  body: Record<string, unknown>,
  current: MockCreative | null,
  placement: MockPlacement,
  upload: MockUpload | undefined,
  uploadChanged: boolean,
) {
  const details: Detail[] = [];
  const has = (key: string) => current === null || key in body;
  const out: Partial<MockCreative> = {};

  if (has('clickAction')) {
    const action = oneOf(body.clickAction, CLICK_ACTIONS, 'clickAction', details);
    if (action) out.clickAction = action;
  }
  const action = out.clickAction ?? current?.clickAction;
  if ((has('clickTarget') || 'clickAction' in out) && action) {
    const target = isText(body.clickTarget)
      ? trimSpec(body.clickTarget)
      : (current?.clickTarget ?? '');
    if (target === '') {
      details.push({ ref: 'clickTarget', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (action === 'OPEN_URL') {
      const check = validateServerLink(target);
      if (!check.ok) details.push({ ref: 'clickTarget', reason: check.reasonKey });
    } else if (action === 'IN_APP_ROUTE') {
      if (!SCREEN_TARGETS.includes(target))
        details.push({ ref: 'clickTarget', reason: 'OUT_OF_RANGE' });
    } else if (target.length > 2048) {
      details.push({ ref: 'clickTarget', reason: 'TOO_LONG' });
    }
    out.clickTarget = target;
  }
  if (has('language')) {
    const language = isText(body.language) ? trimSpec(body.language) : '';
    if (language === '*' || (LANGUAGE_TAG.test(language) && language.length <= 35)) {
      out.language = language;
    } else {
      details.push({ ref: 'language', reason: 'INVALID_LANGUAGE_TAG' });
    }
  }
  if (has('weight')) {
    out.weight = body.weight === undefined ? 100 : whole(body.weight, 'weight', details, 0);
  }
  if (has('skippable')) {
    if (body.skippable === undefined) out.skippable = true;
    else if (typeof body.skippable === 'boolean') out.skippable = body.skippable;
    else details.push({ ref: 'skippable', reason: 'NOT_BOOLEAN' });
  }
  for (const key of ['title', 'body', 'ctaText', 'advertiserName'] as const) {
    if (has(key)) out[key] = optionalText(body[key], key, details);
  }
  if (placement.adFormat === 'NATIVE') {
    for (const key of ['title', 'ctaText'] as const) {
      const value = key in out ? out[key] : current?.[key];
      if ((has(key) || uploadChanged) && !value)
        details.push({ ref: key, reason: 'EMPTY_NOT_ALLOWED' });
    }
  }
  if (placement.adFormat === 'REWARDED') {
    if (has('rewardAfterSeconds') || uploadChanged) {
      const raw =
        'rewardAfterSeconds' in body ? body.rewardAfterSeconds : current?.rewardAfterSeconds;
      if (raw === null || raw === undefined) {
        details.push({ ref: 'rewardAfterSeconds', reason: 'EMPTY_NOT_ALLOWED' });
      } else {
        const seconds = whole(raw, 'rewardAfterSeconds', details, 5, 30);
        if (
          seconds !== undefined &&
          upload?.mediaType === 'VIDEO' &&
          upload.durationSeconds !== null &&
          seconds > upload.durationSeconds
        ) {
          details.push({ ref: 'rewardAfterSeconds', reason: 'OUT_OF_RANGE' });
        }
        if (seconds !== undefined) out.rewardAfterSeconds = seconds;
      }
    }
  } else if (has('rewardAfterSeconds')) {
    out.rewardAfterSeconds = null;
  }
  return { out, details };
}

// ---- the reports ----

function reportQuery(req: { query: Record<string, unknown> }) {
  const range = rangeOf(req as never);
  const details: Detail[] = [];
  const platform = text(req.query.platform);
  if (platform !== '' && platform !== 'ANDROID' && platform !== 'IOS') {
    details.push({ ref: 'platform', reason: 'OUT_OF_RANGE' });
  }
  const channel = text(req.query.channelCode);
  if (channel !== '' && !/^[a-z0-9_-]{2,32}$/.test(channel)) {
    details.push({ ref: 'channelCode', reason: 'OUT_OF_RANGE' });
  }
  throwIf(details);
  const filter: Filter = {
    platform: platform === '' ? null : platform,
    channel: channel === '' ? null : channel,
  };
  return { ...range, days: daysIn(range.from, range.to), filter };
}

/** The sum of the leaves under `keep`, by the key `by` gives (a creative and a country decide the key). */
function groupBy<K extends string>(
  days: string[],
  filter: Filter,
  today: string,
  keys: K[],
  by: (creative: MockCreative, country: string) => K | null,
): Map<K, CountRow> {
  const groups = new Map<K, CountRow>(keys.map((k) => [k, emptyCounts()]));
  for (const creative of adsState.creatives.values()) {
    for (const country of COUNTRIES) {
      const key = by(creative, country);
      if (key === null) continue;
      const into = groups.get(key);
      if (!into) continue;
      for (const day of days) add(into, leaf(creative, day, country, filter, today));
    }
  }
  return groups;
}

const byImpressions = <T extends { impressions: number }>(rows: T[]) =>
  [...rows].sort((a, b) => b.impressions - a.impressions);

export default {
  // ---- campaigns ----
  'GET /api/admin/ads/campaigns': guard(CAMPAIGN_READ, (req) => {
    const status = filterOf(req, 'status', CAMPAIGN_STATUSES);
    const name = trimSpec(text(req.query.name));
    const rows = newest([...adsState.campaigns.values()]).filter(
      (c) => (!status || c.status === status) && (name === '' || contains(c.name, name)),
    );
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(campaignRow), total: page.total });
  }),

  'GET /api/admin/ads/campaigns/:id': guard(CAMPAIGN_READ, (req) =>
    ok(campaignRow(campaignOf(idOf(req)))),
  ),

  'POST /api/admin/ads/campaigns': guard('ADS:CAMPAIGN', (req) => {
    const fields = campaignFields(bodyOf(req), null);
    const at = nowIso();
    const id = String(adsState.next.campaign++);
    const row: MockCampaign = {
      id,
      name: '',
      description: null,
      status: 'DRAFT',
      priority: 100,
      startAt: null,
      endAt: null,
      createdBy: req.admin.id,
      updatedBy: req.admin.id,
      createdAt: at,
      updatedAt: at,
      ...fields,
    };
    adsState.campaigns.set(id, row);
    return ok(campaignRow(row));
  }),

  'PUT /api/admin/ads/campaigns/:id': guard('ADS:CAMPAIGN', (req) => {
    const current = campaignOf(idOf(req));
    if (current.status === 'ENDED')
      throw invalidState('ENDED', 'An ended campaign cannot be changed');
    const fields = campaignFields(bodyOf(req), current);
    Object.assign(current, fields, { updatedBy: req.admin.id, updatedAt: nowIso() });
    return ok(campaignRow(current));
  }),

  'PUT /api/admin/ads/campaigns/:id/status': guard('ADS:CAMPAIGN', (req) => {
    const current = campaignOf(idOf(req));
    const details: Detail[] = [];
    const status = oneOf(bodyOf(req).status, CAMPAIGN_STATUSES, 'status', details);
    throwIf(details);
    if (!status || !NEXT_STATUS[current.status].includes(status)) {
      throw invalidState(
        current.status,
        `A campaign that is ${current.status} cannot become ${status}`,
      );
    }
    Object.assign(current, { status, updatedBy: req.admin.id, updatedAt: nowIso() });
    return ok(campaignRow(current));
  }),

  'DELETE /api/admin/ads/campaigns/:id': guard('ADS:CAMPAIGN', (req) => {
    const current = campaignOf(idOf(req));
    const hasUnits = [...adsState.units.values()].some((u) => u.campaignId === current.id);
    if (!(current.status === 'DRAFT' || current.status === 'ENDED') || hasUnits) {
      throw invalidState(
        current.status,
        'Only a draft or an ended campaign without units can be deleted',
      );
    }
    adsState.campaigns.delete(current.id);
    return ok(null);
  }),

  // ---- placements ----
  'GET /api/admin/ads/placements': guard(PLACEMENT_READ, () =>
    ok({ items: [...adsState.placements.values()].map(placementRow) }),
  ),

  'PUT /api/admin/ads/placements/:id': guard('ADS:PLACEMENT', (req) => {
    const current = placementOf(idOf(req));
    const body = bodyOf(req);
    const rewarded = current.adFormat === 'REWARDED';
    const details: Detail[] = [];
    const out: Partial<MockPlacement> = {};
    for (const key of Object.keys(body)) {
      if (key === 'enabled') {
        if (typeof body.enabled === 'boolean') out.enabled = body.enabled;
        else details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
      } else if (key === 'frequencyCap') {
        // The rewarded placement counts the rewards with it, so it cannot be 0 (unlimited).
        out.frequencyCap = whole(body.frequencyCap, key, details, rewarded ? 1 : 0);
      } else if (key === 'cooldownMinutes') {
        if (rewarded) details.push({ ref: key, reason: 'OUT_OF_RANGE' });
        else out.cooldownMinutes = whole(body.cooldownMinutes, key, details, 0);
      } else if (key === 'rewardCredits') {
        if (!rewarded) details.push({ ref: key, reason: 'OUT_OF_RANGE' });
        else out.rewardCredits = whole(body.rewardCredits, key, details, 1);
      }
    }
    throwIf(details);
    Object.assign(current, out, { updatedAt: nowIso() });
    return ok(placementRow(current));
  }),

  // ---- units ----
  'GET /api/admin/ads/units': guard(UNIT_READ, (req) => {
    const status = filterOf(req, 'status', UNIT_STATUSES);
    const campaignId = text(req.query.campaignId);
    const placementId = text(req.query.placementId);
    const name = trimSpec(text(req.query.name));
    const rows = newest([...adsState.units.values()]).filter(
      (u) =>
        (!status || u.status === status) &&
        (campaignId === '' || u.campaignId === campaignId) &&
        (placementId === '' || u.placementId === placementId) &&
        (name === '' || contains(u.name, name)),
    );
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(unitRow), total: page.total });
  }),

  'GET /api/admin/ads/units/:id': guard('ADS:UNIT', (req) => {
    const unit = unitOf(idOf(req));
    return ok({ ...unitRow(unit), creatives: creativesOfUnit(unit.id).map(creativeRow) });
  }),

  'POST /api/admin/ads/units': guard('ADS:UNIT', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const name = isText(body.name) ? trimSpec(body.name) : '';
    if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
    const weight = body.weight === undefined ? 100 : whole(body.weight, 'weight', details, 0);
    const cap =
      body.dailyImpressionCap === undefined
        ? 0
        : whole(body.dailyImpressionCap, 'dailyImpressionCap', details, 0);
    const targeting = body.targeting === undefined ? {} : body.targeting;
    checkTargeting(targeting, details);
    throwIf(details);
    const campaign = adsState.campaigns.get(text(body.campaignId));
    if (!campaign) throw notFound('campaign');
    if (!adsState.placements.has(text(body.placementId))) throw notFound('placement');
    if (campaign.status === 'ENDED') throw invalidState('ENDED', 'The campaign has ended');
    const at = nowIso();
    const id = String(adsState.next.unit++);
    const row: MockUnit = {
      id,
      campaignId: campaign.id,
      placementId: text(body.placementId),
      name,
      status: 'DRAFT',
      targeting: withoutNulls(targeting as Record<string, unknown>),
      weight: weight ?? 100,
      dailyImpressionCap: cap ?? 0,
      createdBy: req.admin.id,
      updatedBy: req.admin.id,
      createdAt: at,
      updatedAt: at,
    };
    adsState.units.set(id, row);
    return ok(unitRow(row));
  }),

  'PUT /api/admin/ads/units/:id': guard('ADS:UNIT', (req) => {
    const current = unitOf(idOf(req));
    const body = bodyOf(req);
    const details: Detail[] = [];
    const out: Partial<MockUnit> = {};
    if ('name' in body) {
      const name = isText(body.name) ? trimSpec(body.name) : '';
      if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
      else out.name = name;
    }
    if ('weight' in body) out.weight = whole(body.weight, 'weight', details, 0);
    if ('dailyImpressionCap' in body) {
      out.dailyImpressionCap = whole(body.dailyImpressionCap, 'dailyImpressionCap', details, 0);
    }
    if ('targeting' in body) {
      const merged = mergeTargeting(current.targeting as Record<string, unknown>, body.targeting);
      checkTargeting(merged, details);
      out.targeting = merged as MockUnit['targeting'];
    }
    throwIf(details);
    Object.assign(current, out, { updatedBy: req.admin.id, updatedAt: nowIso() });
    return ok(unitRow(current));
  }),

  'PUT /api/admin/ads/units/:id/status': guard('ADS:UNIT', (req) => {
    const current = unitOf(idOf(req));
    const details: Detail[] = [];
    const status = oneOf(bodyOf(req).status, UNIT_STATUSES, 'status', details);
    throwIf(details);
    if (!status || !UNIT_NEXT[current.status].includes(status)) {
      throw invalidState(
        current.status,
        `A unit that is ${current.status} cannot become ${status}`,
      );
    }
    Object.assign(current, { status, updatedBy: req.admin.id, updatedAt: nowIso() });
    return ok(unitRow(current));
  }),

  'DELETE /api/admin/ads/units/:id': guard('ADS:UNIT', (req) => {
    const current = unitOf(idOf(req));
    if (current.status !== 'DRAFT' || creativesOfUnit(current.id).length > 0) {
      throw invalidState(current.status, 'Only a draft unit without creatives can be deleted');
    }
    adsState.units.delete(current.id);
    return ok(null);
  }),

  'GET /api/admin/ads/meta': guard(ANY_ADS, () => ok({ geoConfigured: adsState.geoConfigured })),

  // ---- creatives ----
  'GET /api/admin/ads/creatives': guard('ADS:CREATIVE', (req) => {
    const reviewStatus = filterOf(req, 'reviewStatus', REVIEW_STATUSES);
    const servingStatus = filterOf(req, 'servingStatus', SERVING_STATUSES);
    const type = filterOf(req, 'type', CREATIVE_TYPES);
    const adUnitId = text(req.query.adUnitId);
    const campaignId = text(req.query.campaignId);
    const rows = newest([...adsState.creatives.values()])
      .map(creativeRow)
      .filter(
        (c) =>
          (!reviewStatus || c.reviewStatus === reviewStatus) &&
          (!servingStatus || c.servingStatus === servingStatus) &&
          (!type || c.type === type) &&
          (adUnitId === '' || c.adUnitId === adUnitId) &&
          (campaignId === '' || adsState.units.get(c.adUnitId)?.campaignId === campaignId),
      );
    return ok(paginateQuery(rows, req));
  }),

  'POST /api/admin/ads/media': guard('ADS:CREATIVE', () => {
    if (!adsState.mediaAvailable) {
      throw new MockHttpError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'upload.public_base_url is not configured',
      );
    }
    const media =
      adsState.nextMedia ?? MEDIA_SAMPLES[adsState.mediaCursor++ % MEDIA_SAMPLES.length];
    adsState.nextMedia = null;
    const id = `up-${String(adsState.next.upload++).padStart(6, '0')}`;
    const upload: MockUpload = { id, kind: 'AD_MEDIA', used: false, ...media };
    adsState.uploads.set(id, upload);
    return ok({
      uploadId: id,
      mediaUrl: mediaUrlOf(upload),
      thumbnailUrl: thumbnailUrlOf(upload),
      width: upload.width,
      height: upload.height,
      bytes: upload.bytes,
      durationSeconds: upload.durationSeconds,
      mediaType: upload.mediaType,
    });
  }),

  'POST /api/admin/ads/creatives': guard('ADS:CREATIVE', (req) => {
    const body = bodyOf(req);
    const unitId = text(body.adUnitId);
    const uploadId = text(body.uploadId);
    const head: Detail[] = [];
    if (unitId === '') head.push({ ref: 'adUnitId', reason: 'EMPTY_NOT_ALLOWED' });
    if (uploadId === '') head.push({ ref: 'uploadId', reason: 'EMPTY_NOT_ALLOWED' });
    const unit = unitId === '' ? undefined : unitOf(unitId);
    const placement = unit ? adsState.placements.get(unit.placementId) : undefined;
    // The reward threshold and the native fields need the placement; without one the form is wrong already.
    throwIf(head);
    const found = adsState.uploads.get(uploadId);
    const { out, details } = creativeFields(body, null, placement as MockPlacement, found, true);
    throwIf(details);
    const upload = uploadOf(uploadId);
    const specDetails: Detail[] = [];
    checkSpec(upload, placement as MockPlacement, specDetails);
    throwIf(specDetails);
    upload.used = true;
    const at = nowIso();
    const id = String(adsState.next.creative++);
    const row: MockCreative = {
      id,
      adUnitId: unitId,
      uploadId,
      clickAction: 'OPEN_URL',
      clickTarget: '',
      language: '*',
      reviewStatus: 'DRAFT',
      servingStatus: 'ACTIVE',
      weight: 100,
      rewardAfterSeconds: null,
      skippable: true,
      title: null,
      body: null,
      ctaText: null,
      advertiserName: null,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdBy: req.admin.id,
      createdAt: at,
      updatedAt: at,
      ...out,
    };
    adsState.creatives.set(id, row);
    return ok({ ...creativeRow(row), warnings: warningsFor(row, placement as MockPlacement) });
  }),

  'PUT /api/admin/ads/creatives/:id': guard('ADS:CREATIVE', (req) => {
    const current = adsState.creatives.get(idOf(req));
    if (!current) throw notFound('creative');
    if (current.reviewStatus === 'APPROVED') {
      throw invalidState('APPROVED', 'An approved creative cannot be changed; make a new one');
    }
    const body = bodyOf(req);
    const unit = unitOf(current.adUnitId);
    const placement = placementOf(unit.placementId);
    const newUploadId = 'uploadId' in body ? text(body.uploadId) : current.uploadId;
    const uploadChanged = newUploadId !== current.uploadId;
    const head: Detail[] = [];
    if ('uploadId' in body && newUploadId === '') {
      head.push({ ref: 'uploadId', reason: 'EMPTY_NOT_ALLOWED' });
    }
    throwIf(head);
    const upload = adsState.uploads.get(newUploadId);
    const { out, details } = creativeFields(body, current, placement, upload, uploadChanged);
    throwIf(details);
    let replaced: MockUpload | undefined;
    if (uploadChanged) {
      const fresh = uploadOf(newUploadId);
      const specDetails: Detail[] = [];
      checkSpec(fresh, placement, specDetails);
      throwIf(specDetails);
      fresh.used = true;
      replaced = adsState.uploads.get(current.uploadId);
      out.uploadId = newUploadId;
    }
    if (replaced) adsState.uploads.delete(replaced.id);
    Object.assign(current, out, { updatedAt: nowIso() });
    if (current.reviewStatus === 'REJECTED') {
      Object.assign(current, { reviewStatus: 'DRAFT', reviewNote: null });
    }
    return ok({ ...creativeRow(current), warnings: warningsFor(current, placement) });
  }),

  'PUT /api/admin/ads/creatives/:id/review': guard('ADS:CREATIVE', (req) => {
    const current = adsState.creatives.get(idOf(req));
    if (!current) throw notFound('creative');
    const body = bodyOf(req);
    const details: Detail[] = [];
    const decision = oneOf(
      body.reviewStatus,
      ['APPROVED', 'REJECTED'] as const,
      'reviewStatus',
      details,
    );
    throwIf(details);
    if (current.reviewStatus !== 'DRAFT') {
      throw invalidState(current.reviewStatus, 'Only a draft can be reviewed');
    }
    let note: string | null = null;
    if (decision === 'REJECTED') {
      note = isText(body.reviewNote) ? trimSpec(body.reviewNote) : '';
      if (note === '') details.push({ ref: 'reviewNote', reason: 'EMPTY_NOT_ALLOWED' });
      else if (countCodePoints(note) > 500) details.push({ ref: 'reviewNote', reason: 'TOO_LONG' });
      throwIf(details);
    }
    Object.assign(current, {
      reviewStatus: decision,
      reviewNote: note,
      reviewedBy: req.admin.id,
      reviewedAt: nowIso(),
      updatedAt: nowIso(),
    });
    return ok(creativeRow(current));
  }),

  'PUT /api/admin/ads/creatives/:id/serving-status': guard('ADS:CREATIVE', (req) => {
    const current = adsState.creatives.get(idOf(req));
    if (!current) throw notFound('creative');
    const details: Detail[] = [];
    const status = oneOf(bodyOf(req).servingStatus, SERVING_STATUSES, 'servingStatus', details);
    throwIf(details);
    if (current.reviewStatus !== 'APPROVED') {
      throw invalidState(
        current.reviewStatus,
        'Only an approved creative can be paused or resumed',
      );
    }
    Object.assign(current, { servingStatus: status, updatedAt: nowIso() });
    return ok(creativeRow(current));
  }),

  'DELETE /api/admin/ads/creatives/:id': guard('ADS:CREATIVE', (req) => {
    const current = adsState.creatives.get(idOf(req));
    if (!current) throw notFound('creative');
    if (current.reviewStatus === 'APPROVED') {
      throw invalidState('APPROVED', 'An approved creative cannot be deleted; pause it');
    }
    adsState.uploads.delete(current.uploadId);
    adsState.creatives.delete(current.id);
    return ok(null);
  }),

  // ---- reports ----
  'GET /api/admin/ads/report/overview': guard('ADS:REPORT', (req) => {
    const { days, filter, today } = reportQuery(req);
    const total = emptyCounts();
    const daily: { statDate: string; impressions: number; clicks: number; completions: number }[] =
      [];
    for (const day of days) {
      const row = emptyCounts();
      for (const creative of adsState.creatives.values()) {
        for (const country of COUNTRIES) add(row, leaf(creative, day, country, filter, today));
      }
      add(total, row);
      if (row.impressions > 0) {
        daily.push({
          statDate: day,
          impressions: row.impressions,
          clicks: row.clicks,
          completions: row.completions,
        });
      }
    }
    return ok({ totals: withRatios(total), daily });
  }),

  'GET /api/admin/ads/report/by-placement': guard('ADS:REPORT', (req) => {
    const { days, filter, today } = reportQuery(req);
    const placements = [...adsState.placements.values()];
    const groups = groupBy(
      days,
      filter,
      today,
      placements.map((p) => p.id),
      (creative) => adsState.units.get(creative.adUnitId)?.placementId ?? null,
    );
    return ok(
      byImpressions(
        placements.map((p) => ({
          placementId: p.id,
          slotKey: p.slotKey,
          placementName: p.name,
          ...withRatios(groups.get(p.id) as CountRow),
        })),
      ),
    );
  }),

  'GET /api/admin/ads/report/by-campaign': guard('ADS:REPORT', (req) => {
    const { days, filter, today } = reportQuery(req);
    const campaigns = [...adsState.campaigns.values()];
    const groups = groupBy(
      days,
      filter,
      today,
      campaigns.map((c) => c.id),
      (creative) => adsState.units.get(creative.adUnitId)?.campaignId ?? null,
    );
    return ok(
      byImpressions(
        campaigns.map((c) => ({
          campaignId: c.id,
          campaignName: c.name,
          ...withRatios(groups.get(c.id) as CountRow),
        })),
      ),
    );
  }),

  'GET /api/admin/ads/report/by-creative': guard('ADS:REPORT', (req) => {
    const { days, filter, today } = reportQuery(req);
    const creatives = [...adsState.creatives.values()];
    const groups = groupBy(
      days,
      filter,
      today,
      creatives.map((c) => c.id),
      (creative) => creative.id,
    );
    return ok(
      byImpressions(
        creatives.map((c) => ({
          creativeId: c.id,
          creativeTitle: c.title,
          ...withRatios(groups.get(c.id) as CountRow),
        })),
      ),
    );
  }),

  'GET /api/admin/ads/report/by-country': guard('ADS:REPORT', (req) => {
    const { days, filter, today } = reportQuery(req);
    const groups = groupBy(days, filter, today, [...COUNTRIES], (_creative, country) => country);
    return ok(
      byImpressions(
        COUNTRIES.map((country) => ({ country, ...withRatios(groups.get(country) as CountRow) })),
      ),
    );
  }),

  'GET /api/admin/ads/report/nofill': guard('ADS:REPORT', (req) => {
    const { days, filter } = reportQuery(req);
    return ok(noFillRows(days, filter));
  }),
};
