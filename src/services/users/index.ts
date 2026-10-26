import { apiRequest } from '../../request/apiClient';
import type {
  AbuseCluster,
  AbuseQuery,
  AccountDeletionRow,
  AuthEvent,
  ClusterAccount,
  Page,
  UserDetail,
  UserDevice,
  UserQuery,
  UserRow,
  UserSession,
} from './types';

export * from './types';

const enc = encodeURIComponent;

type Paging = { page: number; pageSize: number };

// ---- the list and the detail (USER:VIEW) ----

/** The address of the spreadsheet export; it takes the same filters as the list (`USER:EXPORT` and `USER:VIEW`). */
export const USERS_EXPORT_URL = '/users/export';

export const listUsers = (params: UserQuery): Promise<Page<UserRow>> =>
  apiRequest({ method: 'GET', url: '/users', params });

export const getUser = (id: string): Promise<UserDetail> =>
  apiRequest({ method: 'GET', url: `/users/${enc(id)}` });

export const listUserSessions = (id: string, params: Paging): Promise<Page<UserSession>> =>
  apiRequest({ method: 'GET', url: `/users/${enc(id)}/sessions`, params });

/** Not paged. */
export const listDevices = (id: string): Promise<{ items: UserDevice[] }> =>
  apiRequest({ method: 'GET', url: `/users/${enc(id)}/devices` });

export const listAuthEvents = (id: string, params: Paging): Promise<Page<AuthEvent>> =>
  apiRequest({ method: 'GET', url: `/users/${enc(id)}/auth-events`, params });

// ---- writes ----

/** `USER:BAN`. The reason is shown to the user, in one language (contract 2.8). */
export const banUser = (id: string, reason: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/users/${enc(id)}/ban`, body: { reason } });

/** `USER:BAN`. */
export const unbanUser = (id: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/users/${enc(id)}/unban` });

/** `USER:DELETION`: starts the same deletion with a grace period that the user can start; the reason goes to the audit log only. */
export const startDeletion = (id: string, reason: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/users/${enc(id)}/deletion`, body: { reason } });

/** `USER:DELETION`: only while the account waits in its grace period. */
export const cancelDeletion = (id: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/users/${enc(id)}/deletion/cancel` });

// ---- deletion tasks (USER:DELETION) ----

export const listAccountDeletions = (
  params: Paging & { status?: string },
): Promise<Page<AccountDeletionRow>> =>
  apiRequest({ method: 'GET', url: '/account-deletions', params });

/** Only a failed task can be retried. */
export const retryAccountDeletion = (id: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/account-deletions/${enc(id)}/retry` });

// ---- abuse clusters (ABUSE:VIEW) ----

export const listAbuseClusters = (params: AbuseQuery): Promise<Page<AbuseCluster>> =>
  apiRequest({ method: 'GET', url: '/abuse/clusters', params });

export const listClusterAccounts = (
  params: Paging & { by: AbuseQuery['by']; key: string },
): Promise<Page<ClusterAccount>> =>
  apiRequest({ method: 'GET', url: '/abuse/clusters/accounts', params });
