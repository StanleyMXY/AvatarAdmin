import { apiRequest } from '../../request/apiClient';
import type { Page, SessionDetail, SessionQuery, SessionRow } from './types';

export * from './types';

/** `GET /sessions` (`SESSION:VIEW`): every session, guest sessions included, newest request first. */
export const listSessions = (params: SessionQuery): Promise<Page<SessionRow>> =>
  apiRequest({ method: 'GET', url: '/sessions', params });

/** `GET /sessions/{id}` (`SESSION:VIEW`); an id that does not exist is 404 `RESOURCE_NOT_FOUND`. */
export const getSession = (id: string): Promise<SessionDetail> =>
  apiRequest({ method: 'GET', url: `/sessions/${encodeURIComponent(id)}` });
