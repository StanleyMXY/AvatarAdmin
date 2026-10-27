import { describe, expect, it } from 'vitest';
import { MockHttpError } from './http';
import { paginate, paginateQuery, pagingOf } from './paginate';
import { makeReq } from './testing';

const rows = Array.from({ length: 45 }, (_, i) => i + 1);

const failure = (fn: () => unknown): MockHttpError => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(MockHttpError);
    return e as MockHttpError;
  }
  throw new Error('expected a failure');
};

describe('paginate', () => {
  it('returns the page and the total of all rows', () => {
    expect(paginate(rows, 1, 20)).toEqual({ items: rows.slice(0, 20), total: 45 });
    expect(paginate(rows, 3, 20)).toEqual({ items: rows.slice(40), total: 45 });
  });

  it('returns an empty page beyond the last one, with the total', () => {
    expect(paginate(rows, 4, 20)).toEqual({ items: [], total: 45 });
    expect(paginate([], 1, 20)).toEqual({ items: [], total: 0 });
  });

  it('accepts the largest page size, 200', () => {
    expect(paginate(rows, 1, 200).items).toHaveLength(45);
  });

  it('rejects pageSize 201 with 400 INVALID_REQUEST and the parameter name', () => {
    const e = failure(() => paginate(rows, 1, 201));
    expect([e.httpStatus, e.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(e.data).toEqual({ details: [{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }] });
  });

  it('rejects page 0, negative pages and pageSize 0', () => {
    expect(failure(() => paginate(rows, 0, 20)).data).toEqual({
      details: [{ ref: 'page', reason: 'OUT_OF_RANGE' }],
    });
    expect(failure(() => paginate(rows, -1, 20)).data).toEqual({
      details: [{ ref: 'page', reason: 'OUT_OF_RANGE' }],
    });
    expect(failure(() => paginate(rows, 1, 0)).data).toEqual({
      details: [{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }],
    });
  });

  it('rejects numbers that are not whole with NOT_AN_INTEGER', () => {
    expect(failure(() => paginate(rows, 1.5, 20)).data).toEqual({
      details: [{ ref: 'page', reason: 'NOT_AN_INTEGER' }],
    });
    expect(failure(() => paginate(rows, 1, Number.NaN)).data).toEqual({
      details: [{ ref: 'pageSize', reason: 'NOT_AN_INTEGER' }],
    });
  });

  it('names every wrong parameter', () => {
    expect(failure(() => paginate(rows, 0, 500)).data).toEqual({
      details: [
        { ref: 'page', reason: 'OUT_OF_RANGE' },
        { ref: 'pageSize', reason: 'OUT_OF_RANGE' },
      ],
    });
  });

  it('does not change the rows', () => {
    const copy = [...rows];
    paginate(rows, 2, 10);
    expect(rows).toEqual(copy);
  });
});

describe('pagingOf and paginateQuery', () => {
  it('defaults to page 1 and pageSize 20', () => {
    expect(pagingOf(makeReq())).toEqual({ page: 1, pageSize: 20 });
    expect(pagingOf(makeReq({ query: { page: '', pageSize: '' } }))).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('reads the query strings', () => {
    expect(pagingOf(makeReq({ query: { page: '3', pageSize: '50' } }))).toEqual({
      page: 3,
      pageSize: 50,
    });
    expect(paginateQuery(rows, makeReq({ query: { page: '2', pageSize: '10' } })).items).toEqual(
      rows.slice(10, 20),
    );
  });

  it('turns text that is not a whole number into NOT_AN_INTEGER, not a silent default', () => {
    const e = failure(() =>
      paginateQuery(rows, makeReq({ query: { page: 'abc', pageSize: '1.5' } })),
    );
    expect(e.data).toEqual({
      details: [
        { ref: 'page', reason: 'NOT_AN_INTEGER' },
        { ref: 'pageSize', reason: 'NOT_AN_INTEGER' },
      ],
    });
  });

  it('does not clamp pageSize=500 to 200: it is rejected', () => {
    expect(failure(() => paginateQuery(rows, makeReq({ query: { pageSize: '500' } }))).code).toBe(
      'INVALID_REQUEST',
    );
  });
});
