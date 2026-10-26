// The in-app notification endpoints of the mock backend (contract 25.3 and 25.4, backend reply 2
// item 16). What the contract leaves open (the `ref` and reason of a refused field, the filters'
// format) follows docs/contract-requests/2026-10-26-admin-frontend-notifications.md.

import { countCodePoints } from '../src/utils/codePoints';
import { validateServerLink } from '../src/utils/linkRule';
import { SCREEN_TARGETS } from '../src/utils/screenTargets';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { META_DEFAULTS } from './_core/meta';
import { type MockNotification, notificationsState } from './_core/notificationsData';
import { paginateQuery } from './_core/paginate';
import { store } from './_core/store';
import { findUser } from './_core/usersData';

type Detail = { ref: string; reason: string };

const TITLE_MAX = 100;
const BODY_MAX = 500;
const TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const TAG_MAX = 35;

const usernameOf = (adminId: string | null) =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);

const listItem = (row: MockNotification) => ({
  id: row.id,
  accountId: row.accountId,
  category: row.category,
  title: row.category === 'ADMIN' ? (row.titleI18n?.en ?? '') : (row.renderedTitle ?? ''),
  isRead: row.isRead,
  linkType: row.linkType,
  linkTarget: row.linkTarget,
  sentBy: row.sentBy,
  sentByUsername: usernameOf(row.sentBy),
  createdAt: row.createdAt,
});

const detailOf = (row: MockNotification) => ({
  id: row.id,
  accountId: row.accountId,
  category: row.category,
  titleI18n: row.titleI18n,
  bodyI18n: row.bodyI18n,
  templateKey: row.templateKey,
  templateParams: row.templateParams,
  linkType: row.linkType,
  linkTarget: row.linkTarget,
  isRead: row.isRead,
  sentBy: row.sentBy,
  sentByUsername: usernameOf(row.sentBy),
  createdAt: row.createdAt,
});

function instant(value: unknown, ref: string): number | null {
  if (value === undefined || value === '') return null;
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time))
    throw invalidRequest(`${ref} is not an instant`, [{ ref, reason: 'INVALID_VALUE' }]);
  return time;
}

/** A map of language tag to text: `en` required, every text 1 to `max` code points once trimmed. */
function texts(input: unknown, ref: 'titleI18n' | 'bodyI18n', max: number, details: Detail[]) {
  const out: Record<string, string> = {};
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
    return out;
  }
  const entries = Object.entries(input as Record<string, unknown>);
  for (const [tag, raw] of entries) {
    const place = `${ref}.${tag}`;
    if (!TAG.test(tag) || tag.length > TAG_MAX) {
      details.push({ ref: place, reason: 'INVALID_LANGUAGE_TAG' });
      continue;
    }
    const text = typeof raw === 'string' ? trimSpec(raw) : '';
    const length = countCodePoints(text);
    if (length === 0) details.push({ ref: place, reason: 'EMPTY_NOT_ALLOWED' });
    else if (length > max) details.push({ ref: place, reason: 'TOO_LONG' });
    else out[tag] = text;
  }
  if (!entries.some(([tag]) => tag === 'en') && !details.some((d) => d.ref === `${ref}.en`)) {
    details.push({ ref: `${ref}.en`, reason: 'EMPTY_NOT_ALLOWED' });
  }
  return out;
}

export default {
  'GET /api/admin/notifications': guard('NOTIFICATION:VIEW', (req) => {
    const { accountId, category, isRead } = req.query as Record<string, string | undefined>;
    const from = instant(req.query.from, 'from');
    const to = instant(req.query.to, 'to');
    let rows = [...notificationsState.rows].sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
    );
    if (accountId) rows = rows.filter((r) => r.accountId === accountId);
    if (category) rows = rows.filter((r) => r.category === category);
    if (isRead === 'true' || isRead === 'false') {
      rows = rows.filter((r) => r.isRead === (isRead === 'true'));
    }
    if (from !== null) rows = rows.filter((r) => Date.parse(r.createdAt) >= from);
    if (to !== null) rows = rows.filter((r) => Date.parse(r.createdAt) < to);
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(listItem), total: page.total });
  }),

  'GET /api/admin/notifications/:id': guard('NOTIFICATION:VIEW', (req) => {
    const row = notificationsState.rows.find((r) => r.id === req.params.id);
    if (!row) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such notification');
    return ok(detailOf(row));
  }),

  'POST /api/admin/notifications/send': guard('NOTIFICATION:SEND', (req) => {
    const input = bodyOf(req);
    const accountIds = input.accountIds;
    const details: Detail[] = [];
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      details.push({ ref: 'accountIds', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (new Set(accountIds).size !== accountIds.length) {
      details.push({ ref: 'accountIds', reason: 'DUPLICATE_VALUE' });
    } else if (accountIds.length > META_DEFAULTS.maxRecipients) {
      details.push({ ref: 'accountIds', reason: 'OUT_OF_RANGE' });
    }
    const title = texts(input.titleI18n, 'titleI18n', TITLE_MAX, details);
    const body = texts(input.bodyI18n, 'bodyI18n', BODY_MAX, details);
    const linkType = typeof input.linkType === 'string' ? input.linkType : 'NONE';
    const linkTarget = typeof input.linkTarget === 'string' ? input.linkTarget : '';
    if (linkType === 'URL') {
      const check = validateServerLink(linkTarget);
      if (!check.ok) details.push({ ref: 'linkTarget', reason: check.reasonKey });
    } else if (linkType === 'SCREEN') {
      if (!SCREEN_TARGETS.includes(linkTarget)) {
        details.push({ ref: 'linkTarget', reason: 'INVALID_VALUE' });
      }
    } else if (linkType !== 'NONE') {
      details.push({ ref: 'linkType', reason: 'INVALID_VALUE' });
    }
    if (details.length > 0) throw invalidRequest('invalid request', details);

    // Every account must exist and be ACTIVE; one that is not refuses the whole batch.
    const ids = accountIds as string[];
    const bad: Detail[] = [];
    for (const id of ids) {
      const user = typeof id === 'string' ? findUser(id) : undefined;
      if (!user) bad.push({ ref: String(id), reason: 'ACCOUNT_NOT_FOUND' });
      else if (user.status !== 'ACTIVE') bad.push({ ref: id, reason: 'ACCOUNT_NOT_ACTIVE' });
    }
    if (bad.length > 0) throw invalidRequest('some accounts cannot receive a message', bad);

    const now = new Date().toISOString();
    for (const accountId of ids) {
      const n = notificationsState.nextId++;
      notificationsState.rows.push({
        id: `n-${String(n).padStart(4, '0')}`,
        accountId,
        category: 'ADMIN',
        titleI18n: title,
        bodyI18n: body,
        templateKey: null,
        templateParams: null,
        renderedTitle: null,
        linkType: linkType as MockNotification['linkType'],
        linkTarget: linkType === 'NONE' ? null : linkTarget,
        isRead: false,
        sentBy: req.admin.id,
        createdAt: now,
      });
    }
    return ok({ created: ids.length });
  }),
};
