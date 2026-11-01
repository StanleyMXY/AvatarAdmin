import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '../mock/_core/store';
import { getToken } from '../src/request/session';
import { signInAsAdmin } from './signInAsAdmin';
import { resetUmiStub, useAccess, useModel } from './stubs/umi-max';

type Me = {
  id?: string;
  username: string;
  superAdmin: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  [key: string]: unknown;
};

function whoAmI() {
  return renderHook(() => ({
    state: useModel('@@initialState').initialState as { me: Me; meta?: unknown },
    access: useAccess() as { canAccess: (code?: string) => boolean },
  })).result.current;
}

beforeEach(() => {
  resetUmiStub();
  resetStore();
});

describe('signInAsAdmin', () => {
  it('signs in to the mock backend and tells the Umi stand-in who it is, with the codes of the preset', () => {
    const admin = signInAsAdmin('root');
    expect(getToken()).not.toBeNull();
    const { state, access } = whoAmI();
    expect(state.me).toEqual({
      id: admin.id,
      username: 'root',
      superAdmin: true,
      mustChangePassword: false,
      permissions: admin.permissions,
    });
    expect(state.meta).toBeUndefined();
    expect(access.canAccess('USER:BAN')).toBe(true);
  });

  it('replaces the codes of the preset, and buttons follow them', () => {
    const admin = signInAsAdmin('root', { codes: ['USER:VIEW'], superAdmin: false });
    expect(admin.permissions).toEqual(['USER:VIEW']);
    const { state, access } = whoAmI();
    expect(state.me.permissions).toEqual(['USER:VIEW']);
    expect(state.me.superAdmin).toBe(false);
    expect(access.canAccess('USER:VIEW')).toBe(true);
    expect(access.canAccess('USER:BAN')).toBe(false);
  });

  it('keeps the flag of the preset unless it is told to change it', () => {
    signInAsAdmin('support');
    expect(whoAmI().state.me.superAdmin).toBe(false);
    signInAsAdmin('support', { superAdmin: true });
    expect(whoAmI().state.me.superAdmin).toBe(true);
  });

  it('hands over what GET /meta gave, and the extra fields of GET /me', () => {
    signInAsAdmin('support', {
      meta: { languages: ['th-TH'] },
      meExtra: { passwordMinLength: 12 },
    });
    const { state } = whoAmI();
    expect(state.meta).toEqual({ languages: ['th-TH'] });
    expect(state.me.passwordMinLength).toBe(12);
  });

  it('leaves the id out of GET /me when it is told to', () => {
    signInAsAdmin('support', { withId: false });
    expect('id' in whoAmI().state.me).toBe(false);
    signInAsAdmin('support', { withId: true });
    expect(whoAmI().state.me.id).toBe('1002');
  });
});
