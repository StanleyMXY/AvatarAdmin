import { apiRequest } from '../../request/apiClient';

export type Page<T> = { items: T[]; total: number };

export type ComplaintStatus =
  | 'RECEIVED'
  | 'INVESTIGATING'
  | 'RESOLVED_REMOVED'
  | 'RESOLVED_NOT_FOUND'
  | 'REJECTED';

export const COMPLAINT_STATUSES: readonly ComplaintStatus[] = [
  'RECEIVED',
  'INVESTIGATING',
  'RESOLVED_REMOVED',
  'RESOLVED_NOT_FOUND',
  'REJECTED',
];

/**
 * What the list can be filtered by: the five states, and OPEN, "not closed", which is RECEIVED and
 * INVESTIGATING together. Case matters to the backend: `open` is refused.
 */
export type ComplaintStatusFilter = ComplaintStatus | 'OPEN';

/** The choices of the filter, "not closed" first. */
export const COMPLAINT_FILTER_STATUSES: readonly ComplaintStatusFilter[] = [
  'OPEN',
  ...COMPLAINT_STATUSES,
];

/** A complaint in one of these states cannot be changed any more (contract 11.6). */
export const CLOSED_COMPLAINT_STATUSES: readonly ComplaintStatus[] = [
  'RESOLVED_REMOVED',
  'RESOLVED_NOT_FOUND',
  'REJECTED',
];

/** The only states a status change can set; RESOLVED_REMOVED is the result of removing avatars. */
export type SettableComplaintStatus = 'INVESTIGATING' | 'RESOLVED_NOT_FOUND' | 'REJECTED';
export const SETTABLE_COMPLAINT_STATUSES: readonly SettableComplaintStatus[] = [
  'INVESTIGATING',
  'RESOLVED_NOT_FOUND',
  'REJECTED',
];

export type Complaint = {
  id: string;
  contactEmail: string;
  description: string;
  status: ComplaintStatus;
  receivedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  handledBy: string | null;
  handledByUsername: string | null;
  relatedAvatarAssetIds: string[];
  overdue: boolean;
  evidenceCount: number;
};

export type ComplaintEvent = {
  id: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus;
  note: string | null;
  adminId: string | null;
  adminUsername: string | null;
  createdAt: string;
};

export type ComplaintDetail = Complaint & { events: ComplaintEvent[] };

export type ComplaintEvidence = { url: string; mediaType: string };

const enc = encodeURIComponent;

/** `GET /likeness-complaints` (`COMPLAINT:VIEW`), sorted by the backend by `dueAt`. */
export async function listComplaints(params: {
  page: number;
  pageSize: number;
  status?: ComplaintStatusFilter;
}): Promise<Page<Complaint>> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/likeness-complaints', params });
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  const items = Array.isArray(list) ? (list as Complaint[]) : [];
  const total = (data as { total?: unknown } | null)?.total;
  return { items, total: typeof total === 'number' ? total : items.length };
}

export const getComplaint = (id: string): Promise<ComplaintDetail> =>
  apiRequest({ method: 'GET', url: `/likeness-complaints/${enc(id)}` });

/** `PUT /likeness-complaints/{id}/status` (`COMPLAINT:MANAGE`); the note is optional and an empty one is not sent. */
export const setComplaintStatus = (
  id: string,
  status: SettableComplaintStatus,
  note?: string,
): Promise<unknown> =>
  apiRequest({
    method: 'PUT',
    url: `/likeness-complaints/${enc(id)}/status`,
    body: note ? { status, note } : { status },
  });

/** `POST /likeness-complaints/{id}/remove-avatars` (`COMPLAINT:MANAGE`): deletes the avatars for good. */
export const removeComplaintAvatars = (id: string, assetIds: string[]): Promise<unknown> =>
  apiRequest({
    method: 'POST',
    url: `/likeness-complaints/${enc(id)}/remove-avatars`,
    body: { assetIds },
  });

/**
 * `GET /likeness-complaints/{id}/evidence/{index}` (`COMPLAINT:VIEW`): index counts from 0. Every
 * read is written to the audit log and the address is signed for a short time, so it is asked again
 * each time the file is shown and never kept.
 */
export const getComplaintEvidence = (id: string, index: number): Promise<ComplaintEvidence> =>
  apiRequest({ method: 'GET', url: `/likeness-complaints/${enc(id)}/evidence/${index}` });
