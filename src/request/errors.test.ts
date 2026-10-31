import { describe, expect, it } from 'vitest';
import {
  ApiError,
  describeError,
  isOutcomeUnknown,
  networkError,
  type Page,
  timeoutError,
} from './errors';

const dict: Record<string, string> = {
  'error.INVALID_REQUEST': 'Some input is not valid',
  'error.ADMIN_FORBIDDEN': 'No permission',
  'error.UNKNOWN': 'Something went wrong',
  'error.NETWORK_ERROR': 'Network problem',
  'reason.NOT_HTTPS': 'The link must start with https://',
  'reason.TOO_LONG': 'Too long',
};
const t = (key: string) => dict[key] ?? key;

const make = (over: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({
    code: 'INVALID_REQUEST',
    httpStatus: 400,
    message: 'backend english',
    data: null,
    ...over,
  });

describe('ApiError', () => {
  it('is an Error with code, httpStatus, message, data and details', () => {
    const e = make({ data: { x: 1 } });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.name).toBe('ApiError');
    expect(e.code).toBe('INVALID_REQUEST');
    expect(e.httpStatus).toBe(400);
    expect(e.message).toBe('backend english');
    expect(e.data).toEqual({ x: 1 });
    expect(e.details).toEqual([]);
  });

  it('takes details from data.details', () => {
    const e = make({ data: { details: [{ ref: 'privacyPolicyUrl', reason: 'NOT_HTTPS' }] } });
    expect(e.details).toEqual([{ ref: 'privacyPolicyUrl', reason: 'NOT_HTTPS' }]);
  });

  it('has an empty details list when data has none or has the wrong shape', () => {
    expect(make({ data: null }).details).toEqual([]);
    expect(make({ data: 'text' }).details).toEqual([]);
    expect(make({ data: { details: 'x' } }).details).toEqual([]);
    expect(
      make({ data: { details: [null, 3, { ref: 1, reason: 2 }, { ref: 'a' }] } }).details,
    ).toEqual([]);
  });

  it('keeps the valid entries and drops the invalid ones', () => {
    const e = make({
      data: {
        details: [
          { ref: 'a', reason: 'TOO_LONG' },
          { nope: true },
          { ref: '0', reason: 'INVALID_PATTERN' },
        ],
      },
    });
    expect(e.details).toEqual([
      { ref: 'a', reason: 'TOO_LONG' },
      { ref: '0', reason: 'INVALID_PATTERN' },
    ]);
  });

  it('has no token or request data in its message', () => {
    expect(make().message).toBe('backend english');
  });
});

describe('describeError', () => {
  it('uses error.<code> for the main text', () => {
    expect(describeError(make({ code: 'ADMIN_FORBIDDEN', httpStatus: 403 }), t).text).toBe(
      'No permission',
    );
  });

  it('gives each detail the localized reason text, not the backend English', () => {
    const e = make({ data: { details: [{ ref: 'privacyPolicyUrl', reason: 'NOT_HTTPS' }] } });
    expect(describeError(e, t).fields).toEqual([
      { ref: 'privacyPolicyUrl', text: 'The link must start with https://' },
    ]);
  });

  it('falls back to the backend message for a reason it does not know', () => {
    const e = make({ data: { details: [{ ref: 'k', reason: 'SOMETHING_NEW' }] } });
    expect(describeError(e, t).fields).toEqual([{ ref: 'k', text: 'backend english' }]);
  });

  it('falls back to the reason code when there is no backend message either', () => {
    const e = make({ message: '', data: { details: [{ ref: 'k', reason: 'SOMETHING_NEW' }] } });
    expect(describeError(e, t).fields).toEqual([{ ref: 'k', text: 'SOMETHING_NEW' }]);
  });

  it('uses error.UNKNOWN with the backend message when error.<code> is missing', () => {
    const e = make({ code: 'A_NEW_CODE', httpStatus: 400 });
    const described = describeError(e, t);
    expect(described.text).toContain('Something went wrong');
    expect(described.text).toContain('backend english');
  });

  it('uses error.UNKNOWN alone when the code is unknown and the message is empty', () => {
    expect(describeError(make({ code: 'A_NEW_CODE', message: '' }), t).text).toBe(
      'Something went wrong',
    );
  });

  it('treats an empty translation as missing', () => {
    const empty = (key: string) => (key === 'error.INVALID_REQUEST' ? '' : t(key));
    expect(describeError(make(), empty).text).toContain('Something went wrong');
  });

  it('has no fields when there are no details', () => {
    expect(describeError(make({ code: 'NETWORK_ERROR', httpStatus: 0 }), t).fields).toEqual([]);
  });

  it('keeps the order of the details and repeats of the same ref', () => {
    const e = make({
      data: {
        details: [
          { ref: '2', reason: 'TOO_LONG' },
          { ref: '0', reason: 'NOT_HTTPS' },
          { ref: '2', reason: 'NOT_HTTPS' },
        ],
      },
    });
    expect(describeError(e, t).fields.map((f) => f.ref)).toEqual(['2', '0', '2']);
  });
});

describe('Page', () => {
  it('is a list with a total', () => {
    const page: Page<{ id: string }> = { items: [{ id: 'a' }], total: 1 };
    expect(page.total).toBe(1);
  });
});

const answered = (code: string, httpStatus: number) =>
  new ApiError({ code, httpStatus, message: '', data: null });

describe('isOutcomeUnknown', () => {
  it('is true when no answer of the backend came back: network, time limit, gateway page, unreadable answer', () => {
    expect(isOutcomeUnknown(networkError())).toBe(true);
    expect(isOutcomeUnknown(timeoutError())).toBe(true);
    for (const status of [502, 503, 504]) {
      expect(isOutcomeUnknown(answered('GATEWAY_UNAVAILABLE', status))).toBe(true);
    }
    expect(isOutcomeUnknown(answered('INVALID_RESPONSE', 200))).toBe(true);
  });

  it('is false when the backend itself said what happened', () => {
    expect(isOutcomeUnknown(answered('INVALID_REQUEST', 400))).toBe(false);
    expect(isOutcomeUnknown(answered('ADMIN_FORBIDDEN', 403))).toBe(false);
    expect(isOutcomeUnknown(answered('RATE_LIMITED', 429))).toBe(false);
    expect(isOutcomeUnknown(answered('INTERNAL_ERROR', 500))).toBe(false);
  });
});
