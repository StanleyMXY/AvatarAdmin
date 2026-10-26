import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { emailState, resetEmailStore } from './_core/emailData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import email from './email.mock';

beforeEach(() => {
  resetStore();
  resetEmailStore(new Date('2026-10-26T10:00:00Z'));
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (email as unknown as Record<string, H>)[name];
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const LIST = 'GET /api/admin/email/templates';
const SAVE = 'PUT /api/admin/email/templates/:templateCode';
const RESET = 'POST /api/admin/email/templates/:templateCode/reset';
const list = (user = 'root') => call(h(LIST), { headers: { authorization: tokenOf(user) } });
const save = (templateCode: string, body: unknown, user = 'root') =>
  call(h(SAVE), { headers: { authorization: tokenOf(user) }, params: { templateCode }, body });
const reset = (templateCode: string, user = 'root') =>
  call(h(RESET), { headers: { authorization: tokenOf(user) }, params: { templateCode } });
const itemOf = async (code: string) => {
  const found = (await list()).body.data.items.find(
    (i: { templateCode: string }) => i.templateCode === code,
  );
  if (!found) throw new Error(`no template ${code}`);
  return found;
};

describe('GET /email/templates (contract 17.4 table, item 14)', () => {
  it('answers the five templates by template code, ascending, with the fields of the contract and no paging', async () => {
    const answer = await list();
    expect(answer.status).toBe(200);
    const items = answer.body.data.items as Record<string, unknown>[];
    expect(items.map((i) => i.templateCode)).toEqual([
      'DELETION_CONFIRM',
      'LIKENESS_COMPLAINT_RECEIVED',
      'PASSWORD_CHANGED',
      'PASSWORD_RESET',
      'REGISTER_CODE',
    ]);
    expect('total' in answer.body.data).toBe(false);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'body',
          'defaultBody',
          'defaultSubject',
          'modified',
          'placeholders',
          'requiredPlaceholders',
          'subject',
          'templateCode',
          'updatedAt',
          'updatedBy',
          'updatedByUsername',
        ].sort(),
      );
    }
  });

  it('gives the placeholders and the required ones with their braces, as the contract lists them', async () => {
    const byCode = Object.fromEntries(
      (await list()).body.data.items.map((i: { templateCode: string }) => [i.templateCode, i]),
    );
    expect(byCode.REGISTER_CODE.placeholders).toEqual(['{code}', '{minutes}', '{appName}']);
    expect(byCode.REGISTER_CODE.requiredPlaceholders).toEqual(['{code}']);
    expect(byCode.PASSWORD_RESET.requiredPlaceholders).toEqual(['{resetLink}']);
    expect(byCode.DELETION_CONFIRM.requiredPlaceholders).toEqual([
      '{confirmLink}',
      '{subscriptionNotice}',
    ]);
    expect(byCode.PASSWORD_CHANGED.requiredPlaceholders).toEqual(['{time}']);
    expect(byCode.LIKENESS_COMPLAINT_RECEIVED.requiredPlaceholders).toEqual([]);
    for (const item of Object.values(byCode) as {
      placeholders: string[];
      requiredPlaceholders: string[];
    }[]) {
      for (const p of [...item.placeholders, ...item.requiredPlaceholders]) {
        expect(p.startsWith('{') && p.endsWith('}')).toBe(true);
      }
    }
  });

  it('shows the default text and null for the editor when the template was never changed', async () => {
    const item = await itemOf('REGISTER_CODE');
    expect(item).toMatchObject({
      modified: false,
      updatedBy: null,
      updatedByUsername: null,
      updatedAt: null,
    });
    expect([item.subject, item.body]).toEqual([item.defaultSubject, item.defaultBody]);
  });

  it('needs EMAIL:TEMPLATE', async () => {
    expect(
      (await call(h(LIST), { headers: { authorization: tokenOf('support', ['SMS:TEMPLATE']) } }))
        .status,
    ).toBe(403);
    expect((await call(h(LIST), {})).status).toBe(401);
  });
});

describe('PUT /email/templates/{templateCode}', () => {
  it('saves the text, marks it modified and records who changed it', async () => {
    const answer = await save('REGISTER_CODE', {
      subject: ' Your code ',
      body: 'Code {code}, {minutes} min',
    });
    expect(answer.status).toBe(200);
    const item = await itemOf('REGISTER_CODE');
    expect(item).toMatchObject({
      subject: 'Your code',
      body: 'Code {code}, {minutes} min',
      modified: true,
      updatedByUsername: 'root',
    });
    expect(typeof item.updatedAt).toBe('string');
    expect(item.defaultSubject).not.toBe('Your code');
  });

  it('refuses a body without a required placeholder written exactly, case and spaces included', async () => {
    for (const body of [
      'no placeholder',
      'Code code',
      'Code {CODE}',
      'Code { code }',
      'Code {Code}',
    ]) {
      const answer = await save('REGISTER_CODE', { subject: 'x', body });
      expect([answer.status, answer.body.code], body).toEqual([400, 'INVALID_REQUEST']);
      expect(answer.body.message).toContain('{code}');
    }
    expect((await itemOf('REGISTER_CODE')).modified).toBe(false);
  });

  it('names the missing one of two required placeholders', async () => {
    const answer = await save('DELETION_CONFIRM', { subject: 'x', body: 'Open {confirmLink}' });
    expect(answer.status).toBe(400);
    expect(answer.body.message).toContain('{subscriptionNotice}');
    expect(answer.body.message).not.toContain('{confirmLink}');
  });

  it('refuses a subject of 0 or more than 200 characters, counted after the blanks are cut', async () => {
    const body = 'Code {code}';
    expect((await save('REGISTER_CODE', { subject: '   ', body })).body.code).toBe(
      'INVALID_REQUEST',
    );
    expect((await save('REGISTER_CODE', { subject: 'ก'.repeat(201), body })).body.code).toBe(
      'INVALID_REQUEST',
    );
    expect((await save('REGISTER_CODE', { subject: '😀'.repeat(200), body })).status).toBe(200);
    expect((await save('REGISTER_CODE', { subject: ` ${'x'.repeat(200)} `, body })).status).toBe(
      200,
    );
  });

  it('answers 404 for a code the backend does not declare', async () => {
    const answer = await save('NOPE', { subject: 'x', body: 'y' });
    expect([answer.status, answer.body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
  });

  it('needs EMAIL:TEMPLATE', async () => {
    expect((await save('REGISTER_CODE', { subject: 'x', body: '{code}' }, 'support')).status).toBe(
      403,
    );
  });
});

describe('POST /email/templates/{templateCode}/reset', () => {
  it('brings back the default text and the never-changed fields, the same as before any change', async () => {
    const before = await itemOf('PASSWORD_RESET');
    await save('PASSWORD_RESET', { subject: 'Mine', body: 'Go to {resetLink}' });
    expect((await itemOf('PASSWORD_RESET')).modified).toBe(true);
    const answer = await reset('PASSWORD_RESET');
    expect(answer.status).toBe(200);
    expect(await itemOf('PASSWORD_RESET')).toEqual(before);
  });

  it('answers 404 for a code that is not declared and needs EMAIL:TEMPLATE', async () => {
    expect((await reset('NOPE')).status).toBe(404);
    expect((await reset('REGISTER_CODE', 'support')).status).toBe(403);
  });
});

describe('the state', () => {
  it('can be put back, and has default texts in English only, as the contract says', () => {
    expect(emailState.rows.size).toBe(0);
    for (const def of emailState.defaults.values()) {
      expect(def.subject).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});
