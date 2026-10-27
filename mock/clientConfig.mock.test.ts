import { beforeEach, describe, expect, it } from 'vitest';
import {
  clientConfigState,
  resetClientConfigStore,
  simulateOtherAdminEdit,
} from './_core/clientConfigData';
import { resetConfigStore } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import clientConfig from './clientConfig.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetClientConfigStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (clientConfig as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const LIST = 'GET /api/admin/client-config';
const SAVE = 'PUT /api/admin/client-config/:key';
const RESET = 'POST /api/admin/client-config/:key/reset';

const list = (user = 'root') => call(h(LIST), { headers: { authorization: token(user) } });
const itemOf = async (key: string) =>
  ((await list()).body.data.items as Record<string, unknown>[]).find(
    (i) => i.key === key,
  ) as Record<string, unknown>;
const save = (key: string, values: unknown, user = 'root') =>
  call(h(SAVE), { headers: { authorization: token(user) }, params: { key }, body: { values } });
const reset = (key: string, user = 'root') =>
  call(h(RESET), { headers: { authorization: token(user) }, params: { key } });
const detailsOf = (answer: Awaited<ReturnType<typeof save>>) =>
  answer.body.data.details as { ref: string; reason: string }[];

describe('the list', () => {
  it('needs CLIENTCONFIG:VIEW', async () => {
    expect((await list('finance')).status).toBe(403);
  });

  it('has every registered key once, by key, with the fields of the contract, without inviteShareSubtitle', async () => {
    const answer = await list();
    const items = answer.body.data.items as Record<string, unknown>[];
    const keys = items.map((i) => i.key as string);
    expect(keys).toEqual([...keys].sort());
    expect(keys.length).toBe(19);
    expect(keys).not.toContain('inviteShareSubtitle');
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'key',
          'type',
          'localized',
          'readOnly',
          'configured',
          'defaultValue',
          'values',
          'updatedBy',
          'updatedByUsername',
          'updatedAt',
        ].sort(),
      );
    }
    expect(answer.body.data.total).toBeUndefined();
  });

  it('marks exactly the six keys of the system configuration read only, always configured, with the current value under ""', async () => {
    const items = (await list()).body.data.items as Record<string, unknown>[];
    const readOnly = items.filter((i) => i.readOnly).map((i) => i.key);
    expect(readOnly).toEqual([
      'accountDeletionGraceDays',
      'conversationLanguages',
      'phoneLoginEnabled',
      'voiceMaxSeconds',
      'voiceMinSeconds',
      'voiceTranscriptMaxChars',
    ]);
    for (const item of items.filter((i) => i.readOnly)) {
      expect(item.configured).toBe(true);
      expect(item.defaultValue).toBeNull();
      expect(Object.keys(item.values as object)).toEqual(['']);
    }
    expect((await itemOf('conversationLanguages')).type).toBe('STRING_LIST');
    expect(
      Array.isArray(((await itemOf('conversationLanguages')).values as { '': unknown })['']),
    ).toBe(true);
    expect(((await itemOf('phoneLoginEnabled')).values as { '': unknown })['']).toBe(false);
  });

  it('has keys that are not configured ({}), and some in several languages', async () => {
    expect((await itemOf('supportUrl')).values).toEqual({});
    expect((await itemOf('supportUrl')).configured).toBe(false);
    const privacy = await itemOf('privacyPolicyUrl');
    expect(Object.keys(privacy.values as object).length).toBeGreaterThan(2);
    expect(privacy.configured).toBe(true);
    expect(privacy.updatedByUsername).toBe('root');
    expect((await itemOf('drivingLookaheadMs')).defaultValue).toBe(200);
  });
});

describe('saving a key', () => {
  it('needs CLIENTCONFIG:MANAGE; an unknown key is 404', async () => {
    const view = adminOf('reviewer');
    view.permissions = ['CLIENTCONFIG:VIEW'];
    expect((await save('supportUrl', { '': 'https://a.example' }, 'reviewer')).status).toBe(403);
    expect((await save('nope', { '': 'x' })).body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('replaces all the languages of the key at once', async () => {
    const answer = await save('privacyPolicyUrl', {
      '': 'https://example.com/p',
      ar: 'https://example.com/ar/p',
    });
    expect(answer.status).toBe(200);
    const item = await itemOf('privacyPolicyUrl');
    expect(item.values).toEqual({ '': 'https://example.com/p', ar: 'https://example.com/ar/p' });
    expect(item.updatedByUsername).toBe('root');
    expect(item.configured).toBe(true);
  });

  it('refuses the whole key when one language does not pass, and changes nothing', async () => {
    const before = (await itemOf('privacyPolicyUrl')).values;
    const answer = await save('privacyPolicyUrl', {
      '': 'https://example.com/p',
      th: 'http://example.com/th',
      ar: '',
    });
    expect(answer.status).toBe(400);
    expect(answer.body.code).toBe('INVALID_REQUEST');
    expect(detailsOf(answer)).toEqual([
      { ref: 'th', reason: 'NOT_HTTPS' },
      { ref: 'ar', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect((await itemOf('privacyPolicyUrl')).values).toEqual(before);
  });

  it('refuses an empty map, a bad language tag, and a language on a key that is not localized', async () => {
    expect((await save('supportUrl', {})).status).toBe(400);
    expect(detailsOf(await save('supportUrl', { 'not a tag': 'https://a.example' }))).toEqual([
      { ref: 'not a tag', reason: 'INVALID_LANGUAGE_TAG' },
    ]);
    expect(detailsOf(await save('supportEmail', { th: 'a@b.co' }))).toEqual([
      { ref: 'th', reason: 'INVALID_LANGUAGE_TAG' },
    ]);
    expect((await save('supportEmail', { '': 'help@example.com' })).status).toBe(200);
  });

  it('checks each type: https links, e-mail, text length, boolean, integer and its range', async () => {
    expect(detailsOf(await save('supportEmail', { '': 'not-an-email' }))[0].reason).toBe(
      'INVALID_EMAIL',
    );
    expect(detailsOf(await save('supportEmail', { '': '' }))[0].reason).toBe('EMPTY_NOT_ALLOWED');
    expect(detailsOf(await save('inviteShareTitle', { '': 'x'.repeat(201) }))[0].reason).toBe(
      'TOO_LONG',
    );
    expect((await save('inviteShareTitle', { '': '' })).status).toBe(200);
    // the value without a language is `default` in the details (contract 1.4)
    expect(detailsOf(await save('inviteShareText', { '': 'Join {link} {other}' }))[0].ref).toBe(
      'default',
    );
    expect((await save('inviteShareText', { '': 'Join {link} with {code}' })).status).toBe(200);
    expect(detailsOf(await save('drivingLookaheadMs', { '': 1.5 }))[0].reason).toBe(
      'NOT_AN_INTEGER',
    );
    expect(detailsOf(await save('drivingLookaheadMs', { '': 99999 }))[0].reason).toBe(
      'OUT_OF_RANGE',
    );
    expect((await save('drivingLookaheadMs', { '': 250 })).status).toBe(200);
    expect(detailsOf(await save('inviteLinkBase', { '': 'https://a.example/?x=1' }))[0].ref).toBe(
      'default',
    );
    expect((await save('inviteLinkBase', { '': 'https://a.example/i' })).status).toBe(200);
  });

  it('refuses the read-only keys with 400 INVALID_REQUEST, and the list-typed key', async () => {
    for (const key of ['phoneLoginEnabled', 'accountDeletionGraceDays', 'conversationLanguages']) {
      const answer = await save(key, { '': true });
      expect([answer.status, answer.body.code]).toEqual([400, 'INVALID_REQUEST']);
    }
  });
});

describe('resetting a key', () => {
  it('deletes every language of the key; a read-only key is 400; an unknown key is 404', async () => {
    expect((await reset('privacyPolicyUrl')).status).toBe(200);
    const item = await itemOf('privacyPolicyUrl');
    expect(item.values).toEqual({});
    expect(item.configured).toBe(false);
    expect(item.updatedBy).toBeNull();
    expect((await reset('phoneLoginEnabled')).body.code).toBe('INVALID_REQUEST');
    expect((await reset('nope')).body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('needs CLIENTCONFIG:MANAGE', async () => {
    const view = adminOf('reviewer');
    view.permissions = ['CLIENTCONFIG:VIEW'];
    expect((await reset('supportUrl', 'reviewer')).status).toBe(403);
  });

  it('can be put back to the sample data', async () => {
    await reset('privacyPolicyUrl');
    resetClientConfigStore();
    expect(clientConfigState.rows.get('privacyPolicyUrl')?.size).toBeGreaterThan(0);
  });
});

describe('saving with the version that was read (expectedUpdatedAt)', () => {
  const saveWith = (key: string, values: unknown, expectedUpdatedAt: unknown) =>
    call(h(SAVE), {
      headers: { authorization: token('root') },
      params: { key },
      body: { values, expectedUpdatedAt },
    });

  it('saves when the time is the one the key has now, and stores the new values', async () => {
    const read = (await itemOf('privacyPolicyUrl')).updatedAt;
    const answer = await saveWith('privacyPolicyUrl', { '': 'https://example.com/same' }, read);
    expect(answer.status).toBe(200);
    expect((await itemOf('privacyPolicyUrl')).values).toEqual({ '': 'https://example.com/same' });
  });

  it('refuses with 409 INVALID_STATE and the current time when another administrator saved in between, and changes nothing', async () => {
    const read = (await itemOf('privacyPolicyUrl')).updatedAt;
    simulateOtherAdminEdit('privacyPolicyUrl', {
      '': 'https://example.com/theirs',
      th: 'https://example.com/th/theirs',
    });
    const theirs = await itemOf('privacyPolicyUrl');
    const answer = await saveWith('privacyPolicyUrl', { '': 'https://example.com/mine' }, read);
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('INVALID_STATE');
    expect(answer.body.data).toEqual({ updatedAt: theirs.updatedAt });
    expect((await itemOf('privacyPolicyUrl')).values).toEqual(theirs.values);
  });

  it('treats null as "there was no row": fine for a key with none, a 409 once someone configured it', async () => {
    expect((await itemOf('supportUrl')).updatedAt).toBeNull();
    const read = null;
    simulateOtherAdminEdit('supportUrl', { '': 'https://example.com/support' });
    const answer = await saveWith('supportUrl', { '': 'https://example.com/mine' }, read);
    expect(answer.status).toBe(409);
    clientConfigState.rows.delete('supportUrl');
    expect((await saveWith('supportUrl', { '': 'https://example.com/mine' }, null)).status).toBe(
      200,
    );
  });

  it('refuses a time when the key has no row, and without the field saves as before', async () => {
    const answer = await saveWith(
      'supportUrl',
      { '': 'https://example.com/mine' },
      '2026-01-01T00:00:00.000Z',
    );
    expect(answer.status).toBe(409);
    expect((await save('supportUrl', { '': 'https://example.com/mine' })).status).toBe(200);
  });

  it('gives a later time on every simulated edit, even within one millisecond', () => {
    const first = simulateOtherAdminEdit('privacyPolicyUrl', { '': 'https://example.com/a' });
    const second = simulateOtherAdminEdit('privacyPolicyUrl', { '': 'https://example.com/b' });
    expect(second > first).toBe(true);
  });
});

describe('resetting with the version that was read (expectedUpdatedAt)', () => {
  const resetWith = (key: string, expectedUpdatedAt: unknown) =>
    call(h(RESET), {
      headers: { authorization: token('root') },
      params: { key },
      body: { expectedUpdatedAt },
    });

  it('resets when the time is the one the key has now', async () => {
    const read = (await itemOf('privacyPolicyUrl')).updatedAt;
    expect((await resetWith('privacyPolicyUrl', read)).status).toBe(200);
    expect((await itemOf('privacyPolicyUrl')).configured).toBe(false);
  });

  it('refuses with 409 INVALID_STATE and the current time when another administrator saved in between, and deletes nothing', async () => {
    const read = (await itemOf('privacyPolicyUrl')).updatedAt;
    simulateOtherAdminEdit('privacyPolicyUrl', {
      '': 'https://example.com/theirs',
      th: 'https://example.com/th/theirs',
    });
    const theirs = await itemOf('privacyPolicyUrl');
    const answer = await resetWith('privacyPolicyUrl', read);
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('INVALID_STATE');
    expect(answer.body.data).toEqual({ updatedAt: theirs.updatedAt });
    expect((await itemOf('privacyPolicyUrl')).values).toEqual(theirs.values);
  });

  it('treats null as "there was no row": a 409 once someone configured the key', async () => {
    simulateOtherAdminEdit('supportUrl', { '': 'https://example.com/support' });
    expect((await resetWith('supportUrl', null)).status).toBe(409);
    expect((await itemOf('supportUrl')).configured).toBe(true);
  });

  it('without the field resets as before', async () => {
    expect((await reset('privacyPolicyUrl')).status).toBe(200);
  });
});
