import { apiRequest } from '../../request/apiClient';
import type {
  AdCampaign,
  AdCreative,
  AdPlacement,
  AdsMeta,
  AdUnit,
  CampaignInput,
  CampaignPatch,
  CampaignRow,
  CampaignStatus,
  CountryRow,
  CreativeInput,
  CreativePatch,
  CreativeRow,
  CreativeWarning,
  ListReportName,
  NoFillRow,
  Page,
  PlacementPatch,
  PlacementRow,
  ReportOverview,
  ReportParams,
  ReviewStatus,
  ServingStatus,
  UnitInput,
  UnitPatch,
  UnitStatus,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

/**
 * A list answer as a page. The campaigns, units and creatives answer `{ items, total }` and the
 * placements `{ items }` (answers 39): a bare list is not an answer of the backend, so it is not
 * read (it shows as an empty list, like an answer that is not a list at all). A page without a
 * total has as many rows as it shows.
 */
function pageOf<T>(data: unknown): Page<T> {
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { items: [], total: 0 };
  const total = (data as { total?: unknown }).total;
  return { items: items as T[], total: typeof total === 'number' ? total : items.length };
}

const listOf = <T>(data: unknown): T[] => pageOf<T>(data).items;

/** The rows of a report: a list, or `{ items }` (the shape of the reports is not part of answers 39, so both are read). */
const reportRows = <T>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : listOf<T>(data);

const readPage = async <T>(url: string, params: object): Promise<Page<T>> =>
  pageOf<T>(
    await apiRequest<unknown>({ method: 'GET', url, params: params as Record<string, unknown> }),
  );

// ---- campaigns (ADS:CAMPAIGN) ----

export type CampaignQuery = Paging & { name?: string; status?: CampaignStatus };

export const listCampaigns = (query: CampaignQuery): Promise<Page<AdCampaign>> =>
  readPage('/ads/campaigns', query);

export const createCampaign = (body: CampaignInput): Promise<AdCampaign> =>
  apiRequest({ method: 'POST', url: '/ads/campaigns', body });

export const updateCampaign = (id: string, body: CampaignPatch): Promise<AdCampaign> =>
  apiRequest({ method: 'PUT', url: `/ads/campaigns/${enc(id)}`, body });

/** 409 INVALID_STATE (`data.status` is the current state) when the change is not allowed from there. */
export const setCampaignStatus = (id: string, status: CampaignStatus): Promise<AdCampaign> =>
  apiRequest({ method: 'PUT', url: `/ads/campaigns/${enc(id)}/status`, body: { status } });

export const deleteCampaign = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/ads/campaigns/${enc(id)}` });

// ---- placements (ADS:PLACEMENT) ----

export const listPlacements = async (): Promise<AdPlacement[]> =>
  listOf<AdPlacement>(await apiRequest<unknown>({ method: 'GET', url: '/ads/placements' }));

export const updatePlacement = (id: string, body: PlacementPatch): Promise<AdPlacement> =>
  apiRequest({ method: 'PUT', url: `/ads/placements/${enc(id)}`, body });

// ---- units (ADS:UNIT) ----

export type UnitQuery = Paging & {
  campaignId?: string;
  placementId?: string;
  status?: UnitStatus;
  name?: string;
};

export const listUnits = (query: UnitQuery): Promise<Page<AdUnit>> => readPage('/ads/units', query);

export const createUnit = (body: UnitInput): Promise<AdUnit> =>
  apiRequest({ method: 'POST', url: '/ads/units', body });

export const updateUnit = (id: string, body: UnitPatch): Promise<AdUnit> =>
  apiRequest({ method: 'PUT', url: `/ads/units/${enc(id)}`, body });

export const setUnitStatus = (id: string, status: UnitStatus): Promise<AdUnit> =>
  apiRequest({ method: 'PUT', url: `/ads/units/${enc(id)}/status`, body: { status } });

export const deleteUnit = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/ads/units/${enc(id)}` });

/**
 * `GET /ads/meta`, open to every `ADS:*` code: whether the geo database is set up, the tolerance of
 * the ratio check of a creative and the count of creatives that cannot be skipped on a full-screen
 * placement. A value that is not of its type is `null`, never guessed.
 */
export async function getAdsMeta(): Promise<AdsMeta> {
  const data = (await apiRequest<unknown>({ method: 'GET', url: '/ads/meta' })) as {
    geoConfigured?: unknown;
    creativeAspectTolerancePercent?: unknown;
    notSkippableFullScreenCount?: unknown;
  } | null;
  const count = data?.notSkippableFullScreenCount;
  const tolerance = data?.creativeAspectTolerancePercent;
  return {
    geoConfigured: typeof data?.geoConfigured === 'boolean' ? data.geoConfigured : null,
    creativeAspectTolerancePercent:
      typeof tolerance === 'number' && Number.isFinite(tolerance) && tolerance >= 0
        ? tolerance
        : null,
    notSkippableFullScreenCount:
      typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null,
  };
}

// ---- creatives (ADS:CREATIVE) ----

export type CreativeQuery = Paging & {
  adUnitId?: string;
  campaignId?: string;
  reviewStatus?: ReviewStatus;
  servingStatus?: ServingStatus;
  type?: string;
};

export const listCreatives = (query: CreativeQuery): Promise<Page<AdCreative>> =>
  readPage('/ads/creatives', query);

/** The answer of a create or an update is the creative and, when the save was not blocked, its `warnings`. */
export type CreativeSaved = AdCreative & { warnings?: unknown };

export const createCreative = (body: CreativeInput): Promise<CreativeSaved> =>
  apiRequest({ method: 'POST', url: '/ads/creatives', body });

export const updateCreative = (id: string, body: CreativePatch): Promise<CreativeSaved> =>
  apiRequest({ method: 'PUT', url: `/ads/creatives/${enc(id)}`, body });

/** The note is needed for a rejection. */
export const reviewCreative = (
  id: string,
  body: { reviewStatus: 'APPROVED' | 'REJECTED'; reviewNote?: string },
): Promise<AdCreative> =>
  apiRequest({ method: 'PUT', url: `/ads/creatives/${enc(id)}/review`, body });

export const setServingStatus = (id: string, servingStatus: ServingStatus): Promise<AdCreative> =>
  apiRequest({
    method: 'PUT',
    url: `/ads/creatives/${enc(id)}/serving-status`,
    body: { servingStatus },
  });

export const deleteCreative = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/ads/creatives/${enc(id)}` });

/** The warnings of a saved creative (`data.warnings`): the entries that have a text code, with their message. */
export function warningsOf(data: unknown): CreativeWarning[] {
  const list = (data as { warnings?: unknown } | null)?.warnings;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { code, message } = entry as { code?: unknown; message?: unknown };
    return typeof code === 'string' && code !== ''
      ? [{ code, message: typeof message === 'string' ? message : '' }]
      : [];
  });
}

// ---- helpers for the pickers ----

const ALL_PAGE_SIZE = 200;
const ALL_MAX_PAGES = 50;

/**
 * Every row of a paged list, for a picker. It reads page after page until it has `total` rows and
 * stops at a page with no rows, so an answer whose total is wrong cannot make it loop.
 */
export async function loadAllPages<T>(
  read: (page: number, pageSize: number) => Promise<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= ALL_MAX_PAGES; page += 1) {
    const answer = await read(page, ALL_PAGE_SIZE);
    rows.push(...answer.items);
    if (answer.items.length === 0 || rows.length >= answer.total) break;
  }
  return rows;
}

// ---- reports (ADS:REPORT) ----

type ListReportRows = {
  'by-placement': PlacementRow;
  'by-campaign': CampaignRow;
  'by-creative': CreativeRow;
  'by-country': CountryRow;
  nofill: NoFillRow;
};

export function getReport(name: 'overview', params: ReportParams): Promise<ReportOverview>;
export function getReport<N extends ListReportName>(
  name: N,
  params: ReportParams,
): Promise<ListReportRows[N][]>;
export async function getReport(
  name: 'overview' | ListReportName,
  params: ReportParams,
): Promise<unknown> {
  const data = await apiRequest<unknown>({
    method: 'GET',
    url: `/ads/report/${name}`,
    params: { ...params },
  });
  if (name !== 'overview') return reportRows(data);
  const overview = data as { totals?: unknown; daily?: unknown } | null;
  const totals =
    typeof overview?.totals === 'object' && overview.totals !== null ? overview.totals : {};
  return { totals, daily: Array.isArray(overview?.daily) ? overview.daily : [] };
}
