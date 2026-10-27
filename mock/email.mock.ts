// The e-mail template endpoints of the mock backend (contract 17.4: the table row and item 14 of the
// field tables). The placeholders carry their braces; the required ones are looked for in the body
// exactly as written, with case (reply 2 of the backend). A missing one is 400 INVALID_REQUEST whose
// message names it.

import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { emailState } from './_core/emailData';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { store } from './_core/store';

const SUBJECT_MAX = 200;

function view(templateCode: string) {
  const def = emailState.defaults.get(templateCode);
  if (!def) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such template');
  const row = emailState.rows.get(templateCode);
  return {
    templateCode,
    subject: row?.subject ?? def.subject,
    body: row?.body ?? def.body,
    defaultSubject: def.subject,
    defaultBody: def.body,
    modified: row !== undefined,
    updatedBy: row?.updatedBy ?? null,
    updatedByUsername: row ? (store.admins.get(row.updatedBy)?.username ?? null) : null,
    updatedAt: row?.updatedAt ?? null,
    placeholders: def.placeholders,
    requiredPlaceholders: def.requiredPlaceholders,
  };
}

export default {
  'GET /api/admin/email/templates': guard('EMAIL:TEMPLATE', () =>
    ok({
      items: [...emailState.defaults.keys()].sort().map((code) => view(code)),
    }),
  ),

  'PUT /api/admin/email/templates/:templateCode': guard('EMAIL:TEMPLATE', (req) => {
    const code = req.params.templateCode;
    const def = emailState.defaults.get(code);
    if (!def) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such template');
    const input = bodyOf(req);
    const subject = typeof input.subject === 'string' ? trimSpec(input.subject) : '';
    const body = typeof input.body === 'string' ? trimSpec(input.body) : '';
    const length = countCodePoints(subject);
    if (length < 1 || length > SUBJECT_MAX) {
      throw invalidRequest('The subject must be 1 to 200 characters', [
        { ref: 'subject', reason: length < 1 ? 'EMPTY_NOT_ALLOWED' : 'TOO_LONG' },
      ]);
    }
    if (body === '') {
      throw invalidRequest('The body must not be empty', [
        { ref: 'body', reason: 'EMPTY_NOT_ALLOWED' },
      ]);
    }
    const missing = def.requiredPlaceholders.filter((placeholder) => !body.includes(placeholder));
    if (missing.length > 0) {
      throw new MockHttpError(
        400,
        'INVALID_REQUEST',
        `The body must contain ${missing.join(', ')}`,
        { details: [{ ref: 'body', reason: 'EMPTY_NOT_ALLOWED' }] },
      );
    }
    emailState.rows.set(code, {
      subject,
      body,
      updatedBy: req.admin.id,
      updatedAt: new Date().toISOString(),
    });
    return ok(view(code));
  }),

  'POST /api/admin/email/templates/:templateCode/reset': guard('EMAIL:TEMPLATE', (req) => {
    const code = req.params.templateCode;
    if (!emailState.defaults.has(code)) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such template');
    }
    emailState.rows.delete(code);
    return ok(view(code));
  }),
};
