import { describe, expect, it } from 'vitest';
import { parseEnvelope, unwrapResponse } from './envelope';
import type { ApiError } from './errors';

describe('parseEnvelope', () => {
  it('reads code, message and data', () => {
    expect(parseEnvelope('{"code":"200","message":"success","data":{"a":1}}')).toEqual({
      code: '200',
      message: 'success',
      data: { a: 1 },
    });
  });

  it('accepts a missing message and a missing data', () => {
    expect(parseEnvelope('{"code":"X"}')).toEqual({ code: 'X', message: '', data: null });
  });

  it('gives null for anything that is not an envelope', () => {
    for (const text of [
      '',
      'not json',
      '[]',
      '7',
      'null',
      '"x"',
      '{}',
      '{"code":200}',
      '{"code":null}',
      '<html></html>',
    ]) {
      expect(parseEnvelope(text)).toBeNull();
    }
  });

  it('reads Thai, Arabic and emoji text in the message', () => {
    const text = JSON.stringify({ code: 'X', message: 'ข้อผิดพลาด خطأ 😀', data: null });
    expect(parseEnvelope(text)?.message).toBe('ข้อผิดพลาด خطأ 😀');
  });
});

describe('unwrapResponse', () => {
  const fail = (status: number, text: string): ApiError => {
    try {
      unwrapResponse(status, text);
    } catch (e) {
      return e as ApiError;
    }
    throw new Error('expected a failure');
  };

  it('returns data for HTTP 2xx and code "200"', () => {
    expect(unwrapResponse(200, '{"code":"200","message":"success","data":[1,2]}')).toEqual([1, 2]);
    expect(unwrapResponse(201, '{"code":"200","message":"success","data":null}')).toBeNull();
  });

  it('throws the backend code when HTTP is 200 and the code is not "200"', () => {
    const e = fail(200, '{"code":"INVALID_STATE","message":"m","data":{"status":"X"}}');
    expect([e.code, e.httpStatus, e.message, e.data]).toEqual([
      'INVALID_STATE',
      200,
      'm',
      { status: 'X' },
    ]);
  });

  it('throws the backend code on an error status', () => {
    const e = fail(404, '{"code":"RESOURCE_NOT_FOUND","message":"role not found","data":null}');
    expect([e.code, e.httpStatus]).toEqual(['RESOURCE_NOT_FOUND', 404]);
  });

  it('throws INVALID_RESPONSE for a body that is no envelope', () => {
    expect(fail(200, 'x').code).toBe('INVALID_RESPONSE');
    expect(fail(500, '<html>').code).toBe('INVALID_RESPONSE');
    expect(fail(500, '<html>').httpStatus).toBe(500);
  });

  it('throws INVALID_RESPONSE for success code on an error status', () => {
    expect(fail(500, '{"code":"200","message":"success","data":1}').code).toBe('INVALID_RESPONSE');
  });

  it('throws RATE_LIMITED for a 429 without an envelope', () => {
    const e = fail(429, '');
    expect([e.code, e.httpStatus]).toEqual(['RATE_LIMITED', 429]);
  });
});
