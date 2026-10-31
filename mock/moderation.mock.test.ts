import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore, saved } from './_core/configStore';
import {
  expireSignedAddresses,
  findRecord,
  moderationState,
  RECORD_ID,
  resetModerationStore,
  simulateOtherRuleListEdit,
} from './_core/moderationData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import moderation from './moderation.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetModerationStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (moderation as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, user: string, query: Record<string, unknown> = {}, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, user: string, body: unknown, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const RECORDS = 'GET /api/admin/moderation/records';
const RECORD = 'GET /api/admin/moderation/records/:id';
const CONTENT = 'GET /api/admin/moderation/records/:id/content';
const DECISION = 'POST /api/admin/moderation/records/:id/decision';
const STATS = 'GET /api/admin/moderation/stats';
const RULES = 'GET /api/admin/moderation/text-rules';
const SAVE_RULES = 'PUT /api/admin/moderation/text-rules';
const MEDIA = 'GET /api/admin/moderation/mock-media/:kind';

const WIDE_SPACE = String.fromCodePoint(0x3000);
const NBSP = String.fromCharCode(0xa0);

describe('permissions (contract 17.4, content moderation row)', () => {
  const cases: [string, string, string][] = [
    [RECORDS, 'support', 'MODERATION:VIEW'],
    [RECORD, 'support', 'MODERATION:VIEW'],
    [CONTENT, 'support', 'MODERATION:REVIEW'],
    [DECISION, 'support', 'MODERATION:REVIEW'],
    [STATS, 'support', 'MODERATION:VIEW'],
    [RULES, 'support', 'MODERATION:CONFIG'],
    [SAVE_RULES, 'support', 'MODERATION:CONFIG'],
  ];
  it.each(cases)('%s answers 403 ADMIN_FORBIDDEN for support, who lacks %s', async (name) => {
    const { status, body } = await send(name, 'support', { items: [] }, { id: RECORD_ID.persona });
    expect(status).toBe(403);
    expect(body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('answers 401 without a token on every endpoint but the signed file address', async () => {
    for (const name of Object.keys(moderation)) {
      if (name === MEDIA) continue;
      const { status } = await call(h(name), { params: { id: RECORD_ID.persona } });
      expect(status, name).toBe(401);
    }
  });

  it('needs the three codes one by one: VIEW does not read the content, REVIEW does not edit the rules', async () => {
    const viewOnly = adminOf('finance');
    viewOnly.permissions = ['MODERATION:VIEW'];
    const t = bearer(issueToken(viewOnly).token).authorization;
    const asView = (name: string, params = {}) =>
      call(h(name), { headers: { authorization: t }, params, query: {} });
    expect((await asView(RECORDS)).status).toBe(200);
    expect((await asView(CONTENT, { id: RECORD_ID.persona })).status).toBe(403);
    expect((await asView(RULES)).status).toBe(403);
    viewOnly.permissions = ['MODERATION:REVIEW'];
    const t2 = bearer(issueToken(viewOnly).token).authorization;
    expect(
      (
        await call(h(CONTENT), {
          headers: { authorization: t2 },
          params: { id: RECORD_ID.persona },
        })
      ).status,
    ).toBe(200);
    expect((await call(h(RULES), { headers: { authorization: t2 } })).status).toBe(403);
  });
});

describe('GET /moderation/records', () => {
  it('puts what has waited longest first among the pending ones, then the others, newest first', async () => {
    const { body } = await get(RECORDS, 'reviewer', { pageSize: '200' });
    const rows = body.data.items as { status: string; createdAt: string }[];
    const pending = rows.filter((r) => r.status === 'PENDING_REVIEW');
    expect(pending.length).toBeGreaterThan(5);
    expect(rows.slice(0, pending.length).every((r) => r.status === 'PENDING_REVIEW')).toBe(true);
    const asc = pending.map((r) => r.createdAt);
    expect(asc).toEqual([...asc].sort());
    expect(rows[0]).toMatchObject({ id: RECORD_ID.oldestImage, contentType: 'AVATAR_IMAGE' });
    const rest = rows.slice(pending.length).map((r) => r.createdAt);
    expect(rest).toEqual([...rest].sort().reverse());
    expect(body.data.total).toBe(rows.length);
  });

  it('gives the columns of the contract, the name of the reviewer, and null when that administrator is gone', async () => {
    const { body } = await get(RECORDS, 'reviewer', { pageSize: '200' });
    const rows = body.data.items as Record<string, unknown>[];
    const approved = rows.find((r) => r.id === RECORD_ID.approved);
    expect(approved).toMatchObject({
      status: 'APPROVED',
      reviewedBy: '1004',
      reviewedByUsername: 'reviewer',
    });
    const gone = rows.find((r) => r.id === RECORD_ID.rejected);
    expect(gone).toMatchObject({ reviewedBy: '9999', reviewedByUsername: null });
    for (const key of [
      'id',
      'accountId',
      'contentType',
      'contentRef',
      'source',
      'autoLevel',
      'categories',
      'score',
      'providerRef',
      'status',
      'reporterReason',
      'reporterDetail',
      'reviewedBy',
      'reviewedAt',
      'note',
      'createdAt',
    ]) {
      expect(approved, key).toHaveProperty(key);
    }
  });

  it('filters by status, source and content type, and by the three together', async () => {
    const rows = async (query: Record<string, unknown>) =>
      (await get(RECORDS, 'reviewer', { pageSize: '200', ...query })).body.data.items as {
        status: string;
        source: string;
        contentType: string;
      }[];
    expect((await rows({ status: 'BLOCKED' })).every((r) => r.status === 'BLOCKED')).toBe(true);
    const complaints = await rows({ source: 'COMPLAINT' });
    expect(complaints.length).toBeGreaterThan(0);
    expect(complaints.every((r) => r.source === 'COMPLAINT')).toBe(true);
    const clips = await rows({ contentType: 'ACTION_CLIP' });
    expect(clips.map((r) => r.contentType)).toEqual(['ACTION_CLIP']);
    const both = await rows({ status: 'PENDING_REVIEW', source: 'REPORT', contentType: 'VOICE' });
    expect(both).toHaveLength(1);
  });

  it('refuses a value that is not in the list and a paging that is out of range, naming the parameter', async () => {
    for (const query of [
      { status: 'DONE' },
      { source: 'ROBOT' },
      { contentType: 'GIF' },
      { page: '0' },
      { pageSize: '201' },
    ]) {
      const { status, body } = await get(RECORDS, 'reviewer', query);
      expect(status, JSON.stringify(query)).toBe(400);
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.data.details[0].ref).toBe(Object.keys(query)[0]);
      expect(body.data.details[0].reason).toBe('OUT_OF_RANGE');
    }
  });

  it('pages: 20 a page by default', async () => {
    const { body } = await get(RECORDS, 'reviewer');
    expect(body.data.items).toHaveLength(20);
    expect(body.data.total).toBeGreaterThan(20);
  });
});

describe('GET /moderation/records/{id}', () => {
  it('answers the record, and 404 RESOURCE_NOT_FOUND for another id', async () => {
    const found = await get(RECORD, 'reviewer', {}, { id: RECORD_ID.reportedMessage });
    expect(found.body.data).toMatchObject({
      id: RECORD_ID.reportedMessage,
      source: 'REPORT',
      reporterReason: 'HARASSMENT',
    });
    expect(found.body.data.reporterDetail.length).toBeGreaterThan(10);
    const missing = await get(RECORD, 'reviewer', {}, { id: 'nope' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('GET /moderation/records/{id}/content', () => {
  it('answers text as {kind: TEXT, text}', async () => {
    const { status, body } = await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedMessage });
    expect(status).toBe(200);
    expect(body.data.kind).toBe('TEXT');
    expect(typeof body.data.text).toBe('string');
  });

  it('answers a file as {kind: FILE, mediaType, url} and a voice sample with its transcript in text', async () => {
    const image = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedAvatar })).body.data;
    expect(image).toMatchObject({ kind: 'FILE' });
    expect(image.mediaType).toMatch(/^image\//);
    expect(image.url).toMatch(/^\/api\/admin\/moderation\/mock-media\/image\?sig=/);
    expect(image).not.toHaveProperty('text');
    const voice = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedVoice })).body.data;
    expect(voice.mediaType).toMatch(/^audio\//);
    expect(voice.text).toBeTruthy();
    const clip = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.clip })).body.data;
    expect(clip.mediaType).toMatch(/^video\//);
    expect(clip).not.toHaveProperty('text');
  });

  it('hands out a new address every time and writes a view to the audit list each time', async () => {
    const first = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedAvatar })).body.data;
    const second = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedAvatar })).body.data;
    expect(first.url).not.toBe(second.url);
    expect(moderationState.views).toHaveLength(2);
    expect(moderationState.views[0]).toMatchObject({
      recordId: RECORD_ID.reportedAvatar,
      adminId: '1004',
    });
  });

  it('answers 404 CONTENT_NOT_STORED for an automatically blocked record and for a companion name that was changed since', async () => {
    for (const id of [RECORD_ID.blocked, RECORD_ID.staleCompanionName]) {
      const { status, body } = await get(CONTENT, 'reviewer', {}, { id });
      expect(status, id).toBe(404);
      expect(body.code).toBe('CONTENT_NOT_STORED');
    }
    expect(moderationState.views).toHaveLength(0);
  });

  it('answers 404 for a blocked record even when something is stored under its id', async () => {
    moderationState.contents[RECORD_ID.blocked] = { kind: 'TEXT', text: 'should never be shown' };
    const { status, body } = await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.blocked });
    expect(status).toBe(404);
    expect(body.code).toBe('CONTENT_NOT_STORED');
  });

  it('answers the current companion name for a pending companion-name record', async () => {
    const { body } = await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.companionName });
    expect(body.data).toEqual({ kind: 'TEXT', text: expect.any(String) });
  });

  it('answers 404 RESOURCE_NOT_FOUND for another id', async () => {
    const { status, body } = await get(CONTENT, 'reviewer', {}, { id: 'nope' });
    expect(status).toBe(404);
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('the signed file address', () => {
  const kindOf = (url: string) => url.split('/mock-media/')[1].split('?')[0];
  const sigOf = (url: string) => new URL(url, 'http://x').searchParams.get('sig');
  const fetchFile = (url: string) =>
    call(h(MEDIA), { params: { kind: kindOf(url) }, query: { sig: sigOf(url) } });

  it('serves the file while it is valid, without a token, and refuses it once it has expired', async () => {
    const { url } = (await get(CONTENT, 'reviewer', {}, { id: RECORD_ID.reportedVoice })).body.data;
    // A file answer has no JSON body: the helper sees status 200 and no envelope.
    const ok = await fetchFile(url);
    expect(ok.status).toBe(200);
    expireSignedAddresses();
    const late = await fetchFile(url);
    expect(late.status).toBe(403);
  });

  it('refuses an address that was never handed out', async () => {
    const { status } = await call(h(MEDIA), {
      params: { kind: 'image' },
      query: { sig: 'made-up' },
    });
    expect(status).toBe(403);
  });
});

describe('POST /moderation/records/{id}/decision', () => {
  it('approves without a note: the record is APPROVED, reviewed by the administrator, now', async () => {
    const before = Date.now();
    const { status } = await send(
      DECISION,
      'reviewer',
      { decision: 'APPROVE' },
      { id: RECORD_ID.persona },
    );
    expect(status).toBe(200);
    const record = findRecord(RECORD_ID.persona);
    expect(record).toMatchObject({ status: 'APPROVED', reviewedBy: '1004', note: null });
    expect(Date.parse(record?.reviewedAt ?? '')).toBeGreaterThanOrEqual(before);
  });

  it('rejects with a note, trimmed', async () => {
    await send(
      DECISION,
      'reviewer',
      { decision: 'REJECT', note: `  นี่คือเหตุผล ${WIDE_SPACE}` },
      { id: RECORD_ID.persona },
    );
    expect(findRecord(RECORD_ID.persona)).toMatchObject({ status: 'REJECTED', note: 'นี่คือเหตุผล' });
  });

  it('needs a note to reject: missing, empty and only white space (the contract set, not String.trim) are 400 EMPTY_NOT_ALLOWED on note', async () => {
    for (const note of [undefined, '', '   ', WIDE_SPACE, NBSP]) {
      const { status, body } = await send(
        DECISION,
        'reviewer',
        { decision: 'REJECT', note },
        { id: RECORD_ID.persona },
      );
      expect(status).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'note', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    expect(findRecord(RECORD_ID.persona)?.status).toBe('PENDING_REVIEW');
  });

  it('refuses a decision that is neither APPROVE nor REJECT, and a note that is too long', async () => {
    const bad = await send(DECISION, 'reviewer', { decision: 'MAYBE' }, { id: RECORD_ID.persona });
    expect(bad.body.data.details).toEqual([{ ref: 'decision', reason: 'OUT_OF_RANGE' }]);
    const long = await send(
      DECISION,
      'reviewer',
      { decision: 'APPROVE', note: 'x'.repeat(501) },
      { id: RECORD_ID.persona },
    );
    expect(long.body.data.details).toEqual([{ ref: 'note', reason: 'TOO_LONG' }]);
  });

  it('answers 409 INVALID_STATE with the current status for a record that is not waiting, and 404 for a missing one', async () => {
    const done = await send(
      DECISION,
      'reviewer',
      { decision: 'APPROVE' },
      { id: RECORD_ID.approved },
    );
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('INVALID_STATE');
    expect(done.body.data).toMatchObject({ status: 'APPROVED' });
    const blocked = await send(
      DECISION,
      'reviewer',
      { decision: 'APPROVE' },
      { id: RECORD_ID.blocked },
    );
    expect(blocked.body.data).toMatchObject({ status: 'BLOCKED' });
    const missing = await send(DECISION, 'reviewer', { decision: 'APPROVE' }, { id: 'nope' });
    expect(missing.status).toBe(404);
  });

  it('cannot decide the same record twice (the second one is 409)', async () => {
    await send(DECISION, 'reviewer', { decision: 'REJECT', note: 'a' }, { id: RECORD_ID.persona });
    const again = await send(
      DECISION,
      'reviewer',
      { decision: 'APPROVE' },
      { id: RECORD_ID.persona },
    );
    expect(again.status).toBe(409);
    expect(again.body.data).toMatchObject({ status: 'REJECTED' });
  });
});

describe('GET /moderation/stats', () => {
  const day = (iso: string) => iso.slice(0, 10);
  const today = day(new Date().toISOString());
  const from = day(new Date(Date.now() - 6 * 86_400_000).toISOString());

  it('gives rows by day, content type and source, the average handling time and the oldest waiting time', async () => {
    const { status, body } = await get(STATS, 'reviewer', { from, to: today });
    expect(status).toBe(200);
    const rows = body.data.items as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(3);
    for (const key of [
      'statDate',
      'contentType',
      'source',
      'created',
      'approved',
      'rejected',
      'blocked',
    ]) {
      expect(rows[0], key).toHaveProperty(key);
    }
    const sum = (key: string) => rows.reduce((n, r) => n + (r[key] as number), 0);
    expect(sum('blocked')).toBe(1);
    expect(sum('created')).toBeGreaterThan(20);
    expect(body.data.avgHandleSeconds).toBeGreaterThan(0);
    // The oldest pending record was created 3 days and 4 hours ago.
    expect(body.data.oldestPendingSeconds).toBeGreaterThan(3 * 86_400);
    expect(body.data.oldestPendingSeconds).toBeLessThan(3.5 * 86_400);
  });

  it('gives null for both numbers when nothing was handled and nothing waits', async () => {
    moderationState.records = moderationState.records.filter((r) => r.status === 'BLOCKED');
    const { body } = await get(STATS, 'reviewer', { from, to: today });
    expect(body.data.avgHandleSeconds).toBeNull();
    expect(body.data.oldestPendingSeconds).toBeNull();
  });

  it('refuses a range that is wrong or too long, naming the parameter', async () => {
    const wrong = await get(STATS, 'reviewer', { from: '2026-13-01', to: today });
    expect(wrong.body.data.details[0].ref).toBe('from');
    const reversed = await get(STATS, 'reviewer', { from: today, to: from });
    expect(reversed.status).toBe(400);
    const long = await get(STATS, 'reviewer', { from: '2020-01-01', to: today });
    expect(long.body.data.details[0]).toEqual({ ref: 'to', reason: 'OUT_OF_RANGE' });
  });
});

describe('GET and PUT /moderation/text-rules', () => {
  const rule = (over: Record<string, unknown> = {}) => ({
    pattern: 'ข้อความ',
    matchMode: 'SUBSTRING',
    level: 'REVIEW',
    note: '',
    ...over,
  });

  it('gives {items} in the saved order with id, pattern, matchMode, level and note', async () => {
    const { body } = await get(RULES, 'reviewer');
    expect(body.data.items.length).toBeGreaterThan(5);
    expect(Object.keys(body.data.items[0]).sort()).toEqual([
      'id',
      'level',
      'matchMode',
      'note',
      'pattern',
    ]);
    expect(body.data.items.map((r: { pattern: string }) => r.pattern)).toContain('คำต้องห้าม');
    expect(body.data.items.map((r: { pattern: string }) => r.pattern)).toContain('كلمة محظورة');
  });

  it('replaces the whole list: an element with a current id keeps it, one without is new with a new id, what is not sent is deleted', async () => {
    const current = (await get(RULES, 'reviewer')).body.data.items as { id: string }[];
    const keep = current[2];
    const { status, body } = await send(SAVE_RULES, 'reviewer', {
      items: [
        rule({ pattern: 'new first' }),
        { ...keep, note: 'changed' },
        rule({ id: 'not-in-the-list', pattern: 'stranger' }),
      ],
    });
    expect(status).toBe(200);
    const items = body.data.items as { id: string; pattern: string; note: string }[];
    expect(items.map((r) => r.pattern)).toEqual([
      'new first',
      (keep as unknown as { pattern: string }).pattern,
      'stranger',
    ]);
    expect(items[1].id).toBe(keep.id);
    expect(items[1].note).toBe('changed');
    expect(items[0].id).toBeTruthy();
    expect(current.map((r) => r.id)).not.toContain(items[0].id);
    expect(items[2].id).not.toBe('not-in-the-list');
    expect((await get(RULES, 'reviewer')).body.data.items).toEqual(items);
  });

  it('keeps the text of Thai and Arabic rules, trimmed with the contract set', async () => {
    const { body } = await send(SAVE_RULES, 'reviewer', {
      items: [
        rule({ pattern: `${WIDE_SPACE}ห้ามพูด คำนี้ ` }),
        rule({ pattern: 'كلمة   محظورة', level: 'BLOCK' }),
      ],
    });
    expect(body.data.items.map((r: { pattern: string }) => r.pattern)).toEqual([
      'ห้ามพูด คำนี้',
      'كلمة   محظورة',
    ]);
  });

  it('accepts an empty list (all rules deleted)', async () => {
    const { status, body } = await send(SAVE_RULES, 'reviewer', { items: [] });
    expect(status).toBe(200);
    expect(body.data.items).toEqual([]);
  });

  it('names the failing elements by their index in the request, with the reason codes of the contract, and saves nothing', async () => {
    const before = (await get(RULES, 'reviewer')).body.data.items;
    const { status, body } = await send(SAVE_RULES, 'reviewer', {
      items: [
        rule(),
        rule({ pattern: '   ' }),
        rule({ pattern: 'x'.repeat(201) }),
        rule({ matchMode: 'FUZZY' }),
        rule({ level: 'KILL' }),
        rule({ matchMode: 'REGEX', pattern: '(' }),
        rule({ note: 'n'.repeat(201) }),
      ],
    });
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.data.details).toEqual([
      { ref: '1', reason: 'EMPTY_NOT_ALLOWED' },
      { ref: '2', reason: 'TOO_LONG' },
      { ref: '3', reason: 'OUT_OF_RANGE' },
      { ref: '4', reason: 'OUT_OF_RANGE' },
      { ref: '5', reason: 'INVALID_PATTERN' },
      { ref: '6', reason: 'TOO_LONG' },
    ]);
    expect((await get(RULES, 'reviewer')).body.data.items).toEqual(before);
  });

  it('refuses a substring or whole-word text that is empty once normalised (zero-width characters only), and takes the same text as a regular expression', async () => {
    const zeroWidth = String.fromCharCode(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff);
    const before = (await get(RULES, 'reviewer')).body.data.items;
    const { status, body } = await send(SAVE_RULES, 'reviewer', {
      items: [
        rule({ pattern: zeroWidth, matchMode: 'SUBSTRING' }),
        rule({ pattern: ` ${zeroWidth} `, matchMode: 'WORD' }),
        rule({ pattern: `a${zeroWidth}b`, matchMode: 'WORD' }),
      ],
    });
    expect(status).toBe(400);
    expect(body.data.details).toEqual([
      { ref: '0', reason: 'EMPTY_NOT_ALLOWED' },
      { ref: '1', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect((await get(RULES, 'reviewer')).body.data.items).toEqual(before);
    const regex = await send(SAVE_RULES, 'reviewer', {
      items: [rule({ pattern: zeroWidth, matchMode: 'REGEX' })],
    });
    expect(regex.status).toBe(200);
  });

  it('counts the length of a pattern in code points after trimming', async () => {
    const ok = await send(SAVE_RULES, 'reviewer', { items: [rule({ pattern: '😀'.repeat(200) })] });
    expect(ok.status).toBe(200);
    const long = await send(SAVE_RULES, 'reviewer', {
      items: [rule({ pattern: `${'😀'.repeat(200)}x` })],
    });
    expect(long.body.data.details).toEqual([{ ref: '0', reason: 'TOO_LONG' }]);
    const spaced = await send(SAVE_RULES, 'reviewer', {
      items: [rule({ pattern: ` ${'a'.repeat(200)} ` })],
    });
    expect(spaced.status).toBe(200);
  });

  it('with more rules than moderation.text_rules_max there is one detail: ref items, OUT_OF_RANGE', async () => {
    saved.set('moderation.text_rules_max', {
      value: 2,
      updatedAt: new Date().toISOString(),
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    const { status, body } = await send(SAVE_RULES, 'reviewer', {
      items: [rule(), rule(), rule({ pattern: '' })],
    });
    expect(status).toBe(400);
    expect(body.data.details).toEqual([{ ref: 'items', reason: 'OUT_OF_RANGE' }]);
    expect((await send(SAVE_RULES, 'reviewer', { items: [rule(), rule()] })).status).toBe(200);
  });

  it('refuses a body without {items: [...]}', async () => {
    for (const body of [[], {}, { items: 'x' }]) {
      const { status } = await send(SAVE_RULES, 'reviewer', body);
      expect(status).toBe(400);
    }
  });
});

describe('standing in for a second administrator who saves the rule list', () => {
  it('changes the list the next GET gives, keeps the ids of the rules that stay, and does not touch the list the caller already holds', async () => {
    const before = (await get(RULES, 'reviewer')).body.data.items as { id: string; note: string }[];
    simulateOtherRuleListEdit((rules) => [
      { ...rules[0], note: 'changed by someone else' },
      ...rules.slice(2),
      { id: 'other-new', pattern: 'ใหม่', matchMode: 'SUBSTRING', level: 'BLOCK', note: '' },
    ]);
    const after = (await get(RULES, 'reviewer')).body.data.items as { id: string; note: string }[];
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].note).toBe('changed by someone else');
    expect(after.map((r) => r.id)).not.toContain(before[1].id);
    expect(after[after.length - 1].id).toBe('other-new');
    expect(before[0].note).not.toBe('changed by someone else');
  });
});
