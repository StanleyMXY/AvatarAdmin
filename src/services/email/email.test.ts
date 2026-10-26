import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { listEmailTemplates, resetEmailTemplate, saveEmailTemplate } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));

describe('the e-mail templates', () => {
  it('reads the list as it comes: no paging parameters, the order of the backend', async () => {
    const calls = answer({
      items: [{ templateCode: 'B' }, { templateCode: 'A' }],
    });
    expect(await listEmailTemplates()).toEqual([{ templateCode: 'B' }, { templateCode: 'A' }]);
    const url = new URL(calls[0].url, 'http://x');
    expect([calls[0].init.method, url.pathname, url.search]).toEqual([
      'GET',
      '/api/admin/email/templates',
      '',
    ]);
  });

  it('reads an answer that is not a list as an empty list', async () => {
    answer({ items: 'x' });
    expect(await listEmailTemplates()).toEqual([]);
    answer(null);
    expect(await listEmailTemplates()).toEqual([]);
  });

  it('saves with PUT and only the subject and the body, whatever the code looks like', async () => {
    const calls = answer({});
    await saveEmailTemplate('REGISTER_CODE', { subject: 's', body: 'b {code}' });
    expect([calls[0].init.method, new URL(calls[0].url, 'http://x').pathname]).toEqual([
      'PUT',
      '/api/admin/email/templates/REGISTER_CODE',
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ subject: 's', body: 'b {code}' });
    await saveEmailTemplate('NEW/CODE ä', { subject: 's', body: 'b' });
    expect(new URL(calls[1].url, 'http://x').pathname).toBe(
      '/api/admin/email/templates/NEW%2FCODE%20%C3%A4',
    );
  });

  it('resets with POST …/reset and no body', async () => {
    const calls = answer({});
    await resetEmailTemplate('PASSWORD_RESET');
    expect([calls[0].init.method, new URL(calls[0].url, 'http://x').pathname]).toEqual([
      'POST',
      '/api/admin/email/templates/PASSWORD_RESET/reset',
    ]);
    expect(calls[0].init.body).toBeUndefined();
  });
});
