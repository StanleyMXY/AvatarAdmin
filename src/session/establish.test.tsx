import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../tests/httpStubs';
import { resetUmiStub, setTestInitialState, useModel } from '../../tests/stubs/umi-max';
import { getToken, resetSessionState, setToken } from '../request/session';
import { useSession } from './useSession';

const meBody = (extra: Record<string, unknown> = {}) =>
  envelope('200', {
    id: '1',
    username: 'ploy',
    superAdmin: false,
    mustChangePassword: false,
    permissions: ['USER:VIEW'],
    passwordMinLength: 12,
    ...extra,
  });

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  return renderHook(() => ({
    session: useSession(),
    state: useModel('@@initialState').initialState as Record<string, unknown> | undefined,
  }));
}

describe('useSession.establish when the account cannot be read', () => {
  it.each([
    ['the backend fails', () => jsonResponse(500, envelope('INTERNAL_ERROR'))],
    [
      'the network fails',
      () => {
        throw new TypeError('offline');
      },
    ],
  ])(
    'does not stay half signed in when %s: no token, nothing written to the state',
    async (_name, answer) => {
      setTestInitialState({});
      stubFetch(answer);
      const { result } = mount();
      let target: string | undefined = 'unset';
      await act(async () => {
        target = await result.current.session.establish('tokB');
      });
      expect(target).toBeUndefined();
      expect(getToken()).toBeNull();
      expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
      expect(result.current.state).toEqual({});
    },
  );

  it('clears the notice that was left in the state by an earlier failed read', async () => {
    setToken('tokA');
    setTestInitialState({ unavailable: true });
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
    const { result } = mount();
    await act(async () => {
      await result.current.session.establish('tokB');
    });
    expect(getToken()).toBeNull();
    expect(result.current.state?.unavailable).toBeUndefined();
    expect(result.current.state).toEqual({});
  });

  it('does not clear the token of an account that signed in meanwhile', async () => {
    setTestInitialState({});
    let reject: () => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((_, rej) => {
          reject = () => rej(new TypeError('offline'));
        }),
    );
    const { result } = mount();
    let target: string | undefined = 'unset';
    const pending = act(async () => {
      target = await result.current.session.establish('tokA');
    });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    setToken('tokB');
    reject();
    await pending;
    expect(target).toBeUndefined();
    expect(getToken()).toBe('tokB');
  });

  it('keeps nothing of an account that was read after its token was replaced', async () => {
    setTestInitialState({});
    let release: (r: Response) => void = () => {};
    const calls = stubFetch((call) =>
      call.url.endsWith('/me')
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(jsonResponse(200, envelope('200', { maxRecipients: 1 }))),
    );
    const { result } = mount();
    let target: string | undefined = 'unset';
    const pending = act(async () => {
      target = await result.current.session.establish('tokA');
    });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    setToken('tokB');
    release(jsonResponse(200, meBody({ username: 'old' })));
    await pending;
    expect(target).toBeUndefined();
    expect(getToken()).toBe('tokB');
    expect(result.current.state).toEqual({});
  });
});
