import { apiRequest } from '../../request/apiClient';
import { listConfig } from '../config';
import type { CostRow } from './parseCostBatch';
import type {
  AttributionCampaign,
  AttributionClick,
  AttributionCost,
  AttributionRecord,
  CampaignCreate,
  CampaignFields,
  ClicksQuery,
  CostBody,
  CostQuery,
  LinkQuery,
  Page,
  PerformanceGroup,
  PerformanceRow,
  RecordsQuery,
  SummaryQuery,
  SummaryRow,
} from './types';

export * from './parseCostBatch';
export * from './types';

const enc = encodeURIComponent;

// ---- campaigns (ATTRIBUTION:MANAGE; the list is open to ATTRIBUTION:VIEW as well, contract 17.4 note 5) ----

export type CampaignQuery = {
  keyword?: string;
  enabled?: boolean;
  page: number;
  pageSize: number;
};

export const listCampaigns = (params: CampaignQuery): Promise<Page<AttributionCampaign>> =>
  apiRequest<Page<AttributionCampaign>>({
    method: 'GET',
    url: '/attribution/campaigns',
    params,
  });

const ALL_PAGE_SIZE = 200;
/** The pages stop here even when the backend keeps saying there is more. */
const ALL_MAX_PAGES = 50;

/**
 * Every campaign, for the dropdowns and for the names beside an id. It reads page after page until
 * it has `total` rows, and stops at an empty page, so a wrong total cannot make it loop.
 */
export async function listAllCampaigns(): Promise<AttributionCampaign[]> {
  const rows: AttributionCampaign[] = [];
  for (let page = 1; page <= ALL_MAX_PAGES; page += 1) {
    const answer = await listCampaigns({ page, pageSize: ALL_PAGE_SIZE });
    rows.push(...answer.items);
    if (answer.items.length === 0 || rows.length >= answer.total) break;
  }
  return rows;
}

export const createCampaign = (body: CampaignCreate): Promise<AttributionCampaign> =>
  apiRequest<AttributionCampaign>({ method: 'POST', url: '/attribution/campaigns', body });

/** The `code` is not part of the body: it cannot be changed. Without `facebookAccessToken` the token stays as it is. */
export const updateCampaign = (id: string, body: CampaignFields): Promise<AttributionCampaign> =>
  apiRequest<AttributionCampaign>({
    method: 'PUT',
    url: `/attribution/campaigns/${enc(id)}`,
    body,
  });

/** 400 INVALID_REQUEST when the campaign has no pixel id for the platform, or the link root is not configured. */
export const getCampaignLink = (id: string, params: LinkQuery): Promise<{ url: string }> =>
  apiRequest<{ url: string }>({
    method: 'GET',
    url: `/attribution/campaigns/${enc(id)}/link`,
    params,
  });

// ---- costs (ATTRIBUTION:MANAGE) ----

export const listCosts = (params: CostQuery): Promise<Page<AttributionCost>> =>
  apiRequest<Page<AttributionCost>>({ method: 'GET', url: '/attribution/costs', params });

/** 409 COST_EXISTS when the campaign has a cost on that day already: that one is edited, not made again. */
export const createCost = (body: CostBody): Promise<AttributionCost> =>
  apiRequest<AttributionCost>({ method: 'POST', url: '/attribution/costs', body });

export const updateCost = (id: string, body: CostBody): Promise<AttributionCost> =>
  apiRequest<AttributionCost>({ method: 'PUT', url: `/attribution/costs/${enc(id)}`, body });

export const deleteCost = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/attribution/costs/${enc(id)}` });

/**
 * All or nothing. A (campaign, day) that has a cost already is overwritten (contract 10.5); a bad
 * row refuses the whole batch with the reason of each row in `data.details`.
 */
export const batchCosts = (rows: CostRow[]): Promise<unknown> =>
  apiRequest({ method: 'POST', url: '/attribution/costs/batch', body: rows });

// ---- reports (ATTRIBUTION:VIEW) ----

export const getPerformance = (params: {
  from: string;
  to: string;
  groupBy: PerformanceGroup;
  campaignId?: string;
}): Promise<{ items: PerformanceRow[] }> =>
  apiRequest<{ items: PerformanceRow[] }>({
    method: 'GET',
    url: '/attribution/performance',
    params,
  });

export const getClicks = (params: ClicksQuery): Promise<Page<AttributionClick>> =>
  apiRequest<Page<AttributionClick>>({ method: 'GET', url: '/attribution/clicks', params });

export const getRecords = (params: RecordsQuery): Promise<Page<AttributionRecord>> =>
  apiRequest<Page<AttributionRecord>>({ method: 'GET', url: '/attribution/records', params });

export const getSummary = (params: SummaryQuery): Promise<{ items: SummaryRow[] }> =>
  apiRequest<{ items: SummaryRow[] }>({ method: 'GET', url: '/attribution/summary', params });

// ---- the parameters the pages need (GET /config; the keys are edited with ATTRIBUTION:MANAGE) ----

export type CostSettings = {
  /** `attribution.cost_currency`: the one currency of every cost. */
  currency: string | null;
  /** `attribution.cost_batch_max`. */
  batchMax: number | null;
  /** `attribution.link_base_url`: where the links and the landing page interface are. */
  linkBaseUrl: string | null;
};

/**
 * What the cost pages and the link dialog need from `GET /config`. A value that is missing, empty
 * or of another type is `null`: an administrator who may not edit these keys does not get them, and
 * then the pages show what they can without them. A failed read is thrown.
 */
export async function readCostSettings(): Promise<CostSettings> {
  const { items } = await listConfig();
  const configValue = (key: string): unknown => items.find((item) => item.key === key)?.value;
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  const batch = configValue('attribution.cost_batch_max');
  return {
    currency: text(configValue('attribution.cost_currency')),
    batchMax: typeof batch === 'number' && Number.isInteger(batch) && batch >= 1 ? batch : null,
    linkBaseUrl: text(configValue('attribution.link_base_url')),
  };
}
