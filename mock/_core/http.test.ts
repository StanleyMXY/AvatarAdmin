import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bodyOf,
  fail,
  header,
  invalidRequest,
  MockHttpError,
  ok,
  replyFromError,
  toUmi,
} from './http';
import { call, makeReq } from './testing';

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ok and fail', () => {
  it('build the contract envelope', () => {
    expect(ok({ a: 1 })).toEqual({
      status: 200,
      body: { code: '200', message: 'success', data: { a: 1 } },
    });
    expect(fail(409, 'INVALID_STATE', 'ended', { status: 'ENDED' })).toEqual({
      status: 409,
      body: { code: 'INVALID_STATE', message: 'ended', data: { status: 'ENDED' } },
    });
    expect(fail(404, 'RESOURCE_NOT_FOUND', 'x').body.data).toBeNull();
  });

  it('invalidRequest is a 400 with details', () => {
    const e = invalidRequest('bad', [{ ref: 'k', reason: 'NOT_HTTPS' }]);
    expect([e.httpStatus, e.code, e.data]).toEqual([
      400,
      'INVALID_REQUEST',
      { details: [{ ref: 'k', reason: 'NOT_HTTPS' }] },
    ]);
  });
});

describe('toUmi never lets a handler take the server down', () => {
  it('turns a thrown error into 500 INTERNAL_ERROR and logs it once with the project tag', async () => {
    const { status, body } = await call(
      toUmi(() => {
        throw new TypeError('boom');
      }),
    );
    expect([status, body.code]).toEqual([500, 'INTERNAL_ERROR']);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).toContain('[avatar-admin]');
    expect(JSON.stringify(body)).not.toContain('boom');
  });

  it('answers a MockHttpError as it is, without logging', async () => {
    const { status, body } = await call(
      toUmi(() => {
        throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'role');
      }),
    );
    expect([status, body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('turns a missing return into 500 instead of crashing', async () => {
    const { status, body } = await call(toUmi((() => undefined) as never));
    expect([status, body.code]).toEqual([500, 'INTERNAL_ERROR']);
    const asyncMissing = await call(toUmi((async () => undefined) as never));
    expect(asyncMissing.status).toBe(500);
  });

  it('turns something that is not a reply into 500', async () => {
    for (const value of [
      null,
      'text',
      7,
      {},
      { status: '200', body: {} },
      { status: 200 },
      { status: 200, body: null },
    ]) {
      expect((await call(toUmi((() => value) as never))).status).toBe(500);
    }
  });

  it('turns a body that cannot be written as JSON into 500', async () => {
    let written: unknown;
    const res = {
      status() {
        return res;
      },
      json(value: unknown) {
        if ((value as { data?: unknown }).data === 'bad')
          throw new TypeError('Do not know how to serialize a BigInt');
        written = value;
        return undefined;
      },
    };
    await toUmi(() => ok('bad'))(makeReq(), res);
    expect((written as { code: string }).code).toBe('INTERNAL_ERROR');
  });

  it('works with async handlers', async () => {
    expect((await call(toUmi(async () => ok(1)))).body.data).toBe(1);
  });
});

describe('replyFromError', () => {
  it('maps the errors it knows and hides the rest', () => {
    expect(replyFromError(new MockHttpError(403, 'ADMIN_FORBIDDEN', 'no')).status).toBe(403);
    expect(replyFromError('string').body.code).toBe('INTERNAL_ERROR');
  });
});

describe('header and bodyOf', () => {
  it('header reads by lower-case name and takes the first of a repeated header', () => {
    expect(header(makeReq({ headers: { authorization: 'Bearer x' } }), 'Authorization')).toBe(
      'Bearer x',
    );
    expect(header(makeReq({ headers: { authorization: ['a', 'b'] } }), 'authorization')).toBe('a');
    expect(header(makeReq(), 'authorization')).toBeUndefined();
  });

  it('bodyOf gives an object, and an empty object for anything else', () => {
    expect(bodyOf(makeReq({ body: { a: 1 } }))).toEqual({ a: 1 });
    for (const body of [undefined, null, [], 'text', 5])
      expect(bodyOf(makeReq({ body }))).toEqual({});
  });
});
