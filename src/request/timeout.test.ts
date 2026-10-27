import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { DEFAULT_TIMEOUT_MS, startDeadline, TRANSFER_TIMEOUT_MS, timeoutError } from './timeout';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the time limits', () => {
  it('are 30 seconds for an ordinary request and 5 minutes for a transfer', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(TRANSFER_TIMEOUT_MS).toBe(300_000);
  });
});

describe('timeoutError', () => {
  it('is an ApiError with the code REQUEST_TIMEOUT and no HTTP status', () => {
    const e = timeoutError();
    expect(e).toBeInstanceOf(ApiError);
    expect([e.code, e.httpStatus, e.data]).toEqual(['REQUEST_TIMEOUT', 0, null]);
  });
});

describe('startDeadline', () => {
  it('aborts the signal exactly when the time is up and says it was the time', () => {
    const deadline = startDeadline(1000);
    vi.advanceTimersByTime(999);
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(true);
  });

  it('follows the caller: an abort of the outer signal aborts ours and is not a timeout', () => {
    const outer = new AbortController();
    const deadline = startDeadline(1000, outer.signal);
    outer.abort();
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(deadline.timedOut()).toBe(false);
  });

  it('starts aborted when the outer signal already is', () => {
    const outer = new AbortController();
    outer.abort();
    const deadline = startDeadline(1000, outer.signal);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
  });

  it('dispose stops the clock and lets go of the outer signal', () => {
    const outer = new AbortController();
    const deadline = startDeadline(1000, outer.signal);
    deadline.dispose();
    vi.advanceTimersByTime(5000);
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut()).toBe(false);
    outer.abort();
    expect(deadline.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
