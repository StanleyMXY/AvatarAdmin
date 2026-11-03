import { apiRequest } from '../../request/apiClient';
import type {
  ChannelInput,
  ChannelPatch,
  Page,
  RecordQuery,
  SmsChannel,
  SmsMeta,
  SmsProvider,
  SmsRecord,
  SmsTemplate,
  TemplateInput,
  TemplatePatch,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

/**
 * A list answer as a page. The contract says the lists are `{ items, total }`; a bare list, a page
 * without a total and an answer that is not a list at all are read as what they hold, never as a crash.
 */
function pageOf<T>(data: unknown): Page<T> {
  if (Array.isArray(data)) return { items: data as T[], total: data.length };
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { items: [], total: 0 };
  const total = (data as { total?: unknown }).total;
  return { items: items as T[], total: typeof total === 'number' ? total : items.length };
}

const readPage = async <T>(url: string, params: object): Promise<Page<T>> =>
  pageOf<T>(
    await apiRequest<unknown>({ method: 'GET', url, params: params as Record<string, unknown> }),
  );

// ---- channels (SMS:CHANNEL to read, SMS:CHANNEL:CONFIG to write) ----

export const listChannels = (query: Paging): Promise<Page<SmsChannel>> =>
  readPage('/sms/channels', query);

export const getChannel = (id: string): Promise<SmsChannel> =>
  apiRequest({ method: 'GET', url: `/sms/channels/${enc(id)}` });

export const createChannel = (body: ChannelInput): Promise<SmsChannel> =>
  apiRequest({ method: 'POST', url: '/sms/channels', body });

export const updateChannel = (id: string, body: ChannelPatch): Promise<SmsChannel> =>
  apiRequest({ method: 'PUT', url: `/sms/channels/${enc(id)}`, body });

export const deleteChannel = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/sms/channels/${enc(id)}` });

/** Takes effect at once. */
export const setChannelEnabled = (id: string, enabled: boolean): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/sms/channels/${enc(id)}/enabled`, body: { enabled } });

/** Sends the fixed test text to `mobile`. 429 RATE_LIMITED when the sends of the day are used. */
export const sendTestSms = (id: string, mobile: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/sms/channels/${enc(id)}/test`, body: { mobile } });

/**
 * `GET /sms/meta` (any `SMS:*` code): the registered providers with the hosts their addresses may
 * use and the credential names they need, the test sends left today for the signed-in
 * administrator, and whether phone sign-in is on and how many accounts have a phone number. A field
 * that does not have the expected shape is left out: no provider without a code, no number below
 * zero, no credential name that is not text.
 */
export async function getSmsMeta(): Promise<SmsMeta> {
  const data = (await apiRequest<unknown>({ method: 'GET', url: '/sms/meta' })) as {
    providers?: unknown;
    testRemainingToday?: unknown;
    phoneLoginEnabled?: unknown;
    phoneAccountCount?: unknown;
  } | null;
  const texts = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const providers: SmsProvider[] = Array.isArray(data?.providers)
    ? data.providers.flatMap((entry: unknown) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const { code, allowedHosts, credentialNames } = entry as {
          code?: unknown;
          allowedHosts?: unknown;
          credentialNames?: unknown;
        };
        if (typeof code !== 'string' || code === '') return [];
        return [
          { code, allowedHosts: texts(allowedHosts), credentialNames: texts(credentialNames) },
        ];
      })
    : [];
  const count = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  return {
    providers,
    testRemainingToday: count(data?.testRemainingToday),
    phoneLoginEnabled: typeof data?.phoneLoginEnabled === 'boolean' ? data.phoneLoginEnabled : null,
    phoneAccountCount: count(data?.phoneAccountCount),
  };
}

// ---- templates (SMS:TEMPLATE) ----

export const listTemplates = (query: Paging): Promise<Page<SmsTemplate>> =>
  readPage('/sms/templates', query);

export const createTemplate = (body: TemplateInput): Promise<SmsTemplate> =>
  apiRequest({ method: 'POST', url: '/sms/templates', body });

export const updateTemplate = (id: string, body: TemplatePatch): Promise<SmsTemplate> =>
  apiRequest({ method: 'PUT', url: `/sms/templates/${enc(id)}`, body });

export const deleteTemplate = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/sms/templates/${enc(id)}` });

export const setTemplateEnabled = (id: string, enabled: boolean): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/sms/templates/${enc(id)}/enabled`, body: { enabled } });

// ---- records (SMS:RECORD) ----

export const listRecords = (query: RecordQuery): Promise<Page<SmsRecord>> =>
  readPage('/sms/records', query);

/** The export of the records: the same filters as the list; SMS:RECORD:EXPORT and SMS:RECORD are needed. */
export const SMS_RECORDS_EXPORT_URL = '/sms/records/export';

// ---- helpers for the pages ----

const ALL_PAGE_SIZE = 200;
const ALL_MAX_PAGES = 50;

/**
 * Every row of a paged list. It reads page after page until it has `total` rows and stops at a page
 * with no rows, so an answer whose total is wrong cannot make it loop.
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
