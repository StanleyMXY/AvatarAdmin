import { invalidRequest, type MockReq } from './http';

export type Page<T> = { items: T[]; total: number };

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

/**
 * One page of `rows`. `page` counts from 1 and `pageSize` is 1 to 200, as the backend decides;
 * a value outside is 400 INVALID_REQUEST with details `[{ref: '<parameter>', reason}]`, reason
 * NOT_AN_INTEGER or OUT_OF_RANGE. Nothing is clamped silently.
 */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const details: { ref: string; reason: string }[] = [];
  const check = (ref: string, value: number, min: number, max: number) => {
    if (!Number.isInteger(value)) details.push({ ref, reason: 'NOT_AN_INTEGER' });
    else if (value < min || value > max) details.push({ ref, reason: 'OUT_OF_RANGE' });
  };
  check('page', page, 1, Number.MAX_SAFE_INTEGER);
  check('pageSize', pageSize, 1, MAX_PAGE_SIZE);
  if (details.length > 0) {
    throw invalidRequest(
      `invalid paging parameter: ${details.map((d) => d.ref).join(', ')}`,
      details,
    );
  }
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length };
}

const parseParam = (value: unknown, fallback: number): number => {
  if (value === undefined || value === '') return fallback;
  return typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
};

/** Paging from the query string: `page` defaults to 1, `pageSize` to 20. */
export function pagingOf(req: MockReq): { page: number; pageSize: number } {
  return {
    page: parseParam(req.query.page, 1),
    pageSize: parseParam(req.query.pageSize, DEFAULT_PAGE_SIZE),
  };
}

/** `paginate` with the paging read from the request. */
export function paginateQuery<T>(rows: readonly T[], req: MockReq): Page<T> {
  const { page, pageSize } = pagingOf(req);
  return paginate(rows, page, pageSize);
}
