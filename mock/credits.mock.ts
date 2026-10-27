// The credit endpoints of the mock backend (contract 15.9 and 17.4, credit row). State lives in
// _core/creditsData.ts. The credit pack endpoints follow the temporary shape written in
// docs/contract-requests/2026-10-26-admin-frontend-credits.md.
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import {
  balanceOf,
  creditsState,
  findAccount,
  type MockLedger,
  type MockProduct,
  type MockRequest,
  nextLedgerId,
  nextProductId,
  nextRequestId,
} from './_core/creditsData';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { rangeOf, text } from './_core/statRange';
import { store } from './_core/store';

type Detail = { ref: string; reason: string };

const REASONS = [
  'PURCHASE',
  'REFUND',
  'REFUND_REVERSED',
  'SPEND',
  'ADMIN_GRANT',
  'ADMIN_ADJUST',
  'AD_REWARD',
  'INVITE_REWARD',
  'CHECKIN_REWARD',
  'TASK_REWARD',
  'SUBSCRIPTION_GRANT',
  'SPEND_REVERSED',
];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const STORES = ['APPLE', 'GOOGLE'];
const TEXT_MAX = 500;

const usernameOf = (adminId: string | null): string | null =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);

const requestRow = (r: MockRequest) => ({
  ...r,
  applicantUsername: usernameOf(r.applicantAdminId),
  reviewerUsername: usernameOf(r.reviewerAdminId),
});

const ledgerRow = ({ accountId: _account, ...rest }: MockLedger) => rest;

const fail = (details: Detail[], message = 'invalid request') => invalidRequest(message, details);

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A text field the contract trims (1.9) and counts in code points. */
function textProblem(value: unknown, required: boolean): { value: string; problem: string | null } {
  if (value === undefined || value === null) {
    return { value: '', problem: required ? 'EMPTY_NOT_ALLOWED' : null };
  }
  if (typeof value !== 'string') return { value: '', problem: 'EMPTY_NOT_ALLOWED' };
  const trimmed = trimSpec(value);
  if (trimmed === '') return { value: '', problem: required ? 'EMPTY_NOT_ALLOWED' : null };
  if (countCodePoints(trimmed) > TEXT_MAX) return { value: trimmed, problem: 'TOO_LONG' };
  return { value: trimmed, problem: null };
}

/** An integer query parameter that may be missing; NaN means it was there but not a whole number. */
function intParam(req: MockReq, name: string): number | undefined {
  const raw = text(req.query[name]).trim();
  if (raw === '') return undefined;
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

function instantParam(req: MockReq, name: string): number | undefined {
  const raw = text(req.query[name]);
  if (raw === '') return undefined;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw fail([{ ref: name, reason: 'OUT_OF_RANGE' }], `${name} is not a time`);
  }
  return ms;
}

const byIdDesc = (a: { id: string }, b: { id: string }) => Number(b.id) - Number(a.id);

function checkProduct(body: Record<string, unknown>, creating: boolean): Detail[] {
  const details: Detail[] = [];
  if (creating) {
    if (typeof body.store !== 'string' || !STORES.includes(body.store)) {
      details.push({ ref: 'store', reason: 'OUT_OF_RANGE' });
    }
    if (typeof body.productId !== 'string' || trimSpec(body.productId) === '') {
      details.push({ ref: 'productId', reason: 'EMPTY_NOT_ALLOWED' });
    }
  }
  if (!isInt(body.credits)) details.push({ ref: 'credits', reason: 'NOT_AN_INTEGER' });
  else if (body.credits < 1) details.push({ ref: 'credits', reason: 'OUT_OF_RANGE' });
  if (!isInt(body.sortOrder)) details.push({ ref: 'sortOrder', reason: 'NOT_AN_INTEGER' });
  if (typeof body.enabled !== 'boolean') details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
  return details;
}

const productRow = (p: MockProduct) => ({ ...p, surfaces: p.surfaces.map((s) => ({ ...s })) });

const dayOf = (iso: string): string => iso.slice(0, 10);

export default {
  // ---- credit packs (SUBSCRIPTION:CONFIG) ----
  'GET /api/admin/credit-products': guard('SUBSCRIPTION:CONFIG', () => {
    const items = [...creditsState.products]
      .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id))
      .map(productRow);
    return ok({ items });
  }),

  'POST /api/admin/credit-products': guard('SUBSCRIPTION:CONFIG', (req) => {
    const body = bodyOf(req);
    const details = checkProduct(body, true);
    if (details.length > 0) throw fail(details);
    const productId = trimSpec(body.productId as string);
    const storeName = body.store as MockProduct['store'];
    if (creditsState.products.some((p) => p.store === storeName && p.productId === productId)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The pack exists already', {
        field: 'productId',
      });
    }
    const created: MockProduct = {
      id: nextProductId(),
      store: storeName,
      productId,
      credits: body.credits as number,
      enabled: body.enabled as boolean,
      sortOrder: body.sortOrder as number,
      surfaces: [],
    };
    creditsState.products.push(created);
    return ok(productRow(created));
  }),

  'PUT /api/admin/credit-products/:id': guard('SUBSCRIPTION:CONFIG', (req) => {
    const found = creditsState.products.find((p) => p.id === req.params.id);
    if (!found) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such pack');
    const body = bodyOf(req);
    const details = checkProduct(body, false);
    if (details.length > 0) throw fail(details);
    found.credits = body.credits as number;
    found.enabled = body.enabled as boolean;
    found.sortOrder = body.sortOrder as number;
    if (Array.isArray(body.surfaces)) found.surfaces = body.surfaces as MockProduct['surfaces'];
    return ok(productRow(found));
  }),

  // ---- adjustment requests ----
  'GET /api/admin/credit-adjust-requests': guard('SUBSCRIPTION:VIEW', (req) => {
    const status = text(req.query.status);
    if (status !== '' && !STATUSES.includes(status)) {
      throw fail([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    }
    const accountId = text(req.query.accountId);
    const rows = creditsState.requests
      .filter((r) => (status === '' ? true : r.status === status))
      .filter((r) => (accountId === '' ? true : r.accountId === accountId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(requestRow), total: page.total });
  }),

  'POST /api/admin/credit-adjust-requests': guard('SUBSCRIPTION:GRANT', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const accountId = typeof body.accountId === 'string' ? trimSpec(body.accountId) : '';
    if (accountId === '') details.push({ ref: 'accountId', reason: 'EMPTY_NOT_ALLOWED' });
    if (body.kind !== 'GRANT' && body.kind !== 'ADJUST') {
      details.push({ ref: 'kind', reason: 'OUT_OF_RANGE' });
    }
    if (!isInt(body.delta)) details.push({ ref: 'delta', reason: 'NOT_AN_INTEGER' });
    else if (body.delta === 0 || (body.kind === 'GRANT' && body.delta < 0)) {
      details.push({ ref: 'delta', reason: 'OUT_OF_RANGE' });
    }
    const reason = textProblem(body.reason, true);
    if (reason.problem) details.push({ ref: 'reason', reason: reason.problem });
    if (details.length > 0) throw fail(details);

    const account = findAccount(accountId);
    if (!account) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');
    if (account.status === 'PENDING_DELETION') {
      throw new MockHttpError(
        403,
        'ACCOUNT_DELETION_SCHEDULED',
        'The account is in its grace period',
      );
    }
    if (account.status === 'DELETING') {
      throw new MockHttpError(403, 'ACCOUNT_DELETING', 'The account is being deleted');
    }
    const created: MockRequest = {
      id: nextRequestId(),
      accountId,
      kind: body.kind as MockRequest['kind'],
      delta: body.delta as number,
      reason: reason.value,
      status: 'PENDING',
      applicantAdminId: req.admin.id,
      reviewerAdminId: null,
      reviewNote: null,
      ledgerId: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    creditsState.requests.push(created);
    return ok(requestRow(created));
  }),

  // Order of the checks (see the contract request, question 5): permission, the request exists,
  // the applicant is not the reviewer, the request is pending, the account is not being deleted.
  'POST /api/admin/credit-adjust-requests/:id/approve': guard('CREDIT:REVIEW', (req) => {
    const found = creditsState.requests.find((r) => r.id === req.params.id);
    if (!found) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such request');
    const note = textProblem(bodyOf(req).note, false);
    if (note.problem) throw fail([{ ref: 'note', reason: note.problem }]);
    if (found.applicantAdminId === req.admin.id) {
      throw new MockHttpError(
        403,
        'SELF_REVIEW_FORBIDDEN',
        'The applicant cannot review the request',
      );
    }
    if (found.status !== 'PENDING') {
      throw new MockHttpError(409, 'INVALID_STATE', 'The request is not pending', {
        status: found.status,
      });
    }
    const account = findAccount(found.accountId);
    if (account?.status === 'PENDING_DELETION') {
      throw new MockHttpError(
        403,
        'ACCOUNT_DELETION_SCHEDULED',
        'The account is in its grace period',
      );
    }
    if (account?.status === 'DELETING') {
      throw new MockHttpError(403, 'ACCOUNT_DELETING', 'The account is being deleted');
    }
    // One ledger line, written together with the status change (the real backend does it in one transaction).
    const reviewedAt = new Date().toISOString();
    const entry: MockLedger = {
      id: nextLedgerId(),
      accountId: found.accountId,
      delta: found.delta,
      reason: found.kind === 'GRANT' ? 'ADMIN_GRANT' : 'ADMIN_ADJUST',
      purchaseId: null,
      eventKey: found.id,
      spendKind: null,
      featureKey: null,
      itemKey: null,
      quantity: null,
      note: found.reason,
      createdAt: reviewedAt,
    };
    creditsState.ledger.push(entry);
    found.status = 'APPROVED';
    found.reviewerAdminId = req.admin.id;
    found.reviewNote = note.value === '' ? null : note.value;
    found.ledgerId = entry.id;
    found.reviewedAt = reviewedAt;
    return ok(requestRow(found));
  }),

  'POST /api/admin/credit-adjust-requests/:id/reject': guard('CREDIT:REVIEW', (req) => {
    const note = textProblem(bodyOf(req).note, true);
    if (note.problem) throw fail([{ ref: 'note', reason: note.problem }]);
    const found = creditsState.requests.find((r) => r.id === req.params.id);
    if (!found) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such request');
    if (found.applicantAdminId === req.admin.id) {
      throw new MockHttpError(
        403,
        'SELF_REVIEW_FORBIDDEN',
        'The applicant cannot review the request',
      );
    }
    if (found.status !== 'PENDING') {
      throw new MockHttpError(409, 'INVALID_STATE', 'The request is not pending', {
        status: found.status,
      });
    }
    found.status = 'REJECTED';
    found.reviewerAdminId = req.admin.id;
    found.reviewNote = note.value;
    found.reviewedAt = new Date().toISOString();
    return ok(requestRow(found));
  }),

  // ---- accounts and transactions ----
  'GET /api/admin/credits/accounts': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = text(req.query.accountId);
    const min = intParam(req, 'balanceMin');
    const max = intParam(req, 'balanceMax');
    const details: Detail[] = [];
    if (Number.isNaN(min)) details.push({ ref: 'balanceMin', reason: 'NOT_AN_INTEGER' });
    if (Number.isNaN(max)) details.push({ ref: 'balanceMax', reason: 'NOT_AN_INTEGER' });
    if (details.length > 0) throw fail(details);
    const rows = [...new Set(creditsState.ledger.map((l) => l.accountId))]
      .map((id) => balanceOf(id))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter((row) => (accountId === '' ? true : row.accountId === accountId))
      .filter((row) => (min === undefined ? true : row.balance >= min))
      .filter((row) => (max === undefined ? true : row.balance <= max))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/credits/transactions': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = text(req.query.accountId);
    const reason = text(req.query.reason);
    const type = text(req.query.type);
    const details: Detail[] = [];
    if (reason !== '' && !REASONS.includes(reason))
      details.push({ ref: 'reason', reason: 'OUT_OF_RANGE' });
    if (type !== '' && type !== 'earn' && type !== 'spend') {
      details.push({ ref: 'type', reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) throw fail(details);
    const from = instantParam(req, 'from');
    const to = instantParam(req, 'to');
    const rows = creditsState.ledger
      .filter((l) => (accountId === '' ? true : l.accountId === accountId))
      .filter((l) => (reason === '' ? true : l.reason === reason))
      .filter((l) => (type === 'earn' ? l.delta > 0 : type === 'spend' ? l.delta < 0 : true))
      .filter((l) => (from === undefined ? true : Date.parse(l.createdAt) >= from))
      .filter((l) => (to === undefined ? true : Date.parse(l.createdAt) < to))
      .sort(byIdDesc);
    // The columns of contract 15.9 for this endpoint; `purchaseId` is only in the account view.
    const page = paginateQuery(rows, req);
    return ok({
      items: page.items.map(({ purchaseId: _purchase, ...rest }) => rest),
      total: page.total,
    });
  }),

  'GET /api/admin/accounts/:id/credits': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = req.params.id;
    if (!findAccount(accountId)) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');
    }
    const lines = creditsState.ledger.filter((l) => l.accountId === accountId).sort(byIdDesc);
    const page = paginateQuery(lines, req);
    const totals = balanceOf(accountId);
    return ok({
      balance: totals?.balance ?? 0,
      totalEarned: totals?.totalEarned ?? 0,
      totalSpent: totals?.totalSpent ?? 0,
      items: page.items.map(ledgerRow),
      total: page.total,
    });
  }),

  // ---- statistics (FINANCE:VIEW): UTC days, both included; sandbox purchases are not counted ----
  'GET /api/admin/credits/stats': guard('FINANCE:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const sandbox = new Set(
      creditsState.purchases.filter((p) => p.environment === 'SANDBOX').map((p) => p.id),
    );
    const purchaseOf = (id: string | null) => creditsState.purchases.find((p) => p.id === id);
    const inRange = creditsState.ledger.filter(
      (l) => dayOf(l.createdAt) >= from && dayOf(l.createdAt) <= to,
    );

    const purchases = new Map<
      string,
      { store: string; productId: string; packs: number; credits: number }
    >();
    const refunded = new Map<string, { store: string; productId: string; credits: number }>();
    const spent = new Map<
      string,
      {
        spendKind: string;
        featureKey: string | null;
        itemKey: string | null;
        count: number;
        credits: number;
      }
    >();

    for (const line of inRange) {
      const bought = purchaseOf(line.purchaseId);
      if (line.reason === 'PURCHASE' && bought && !sandbox.has(bought.id)) {
        const key = `${bought.store}/${bought.productId}`;
        const row = purchases.get(key) ?? {
          store: bought.store,
          productId: bought.productId,
          packs: 0,
          credits: 0,
        };
        row.packs += 1;
        row.credits += line.delta;
        purchases.set(key, row);
      } else if (
        (line.reason === 'REFUND' || line.reason === 'REFUND_REVERSED') &&
        bought &&
        !sandbox.has(bought.id)
      ) {
        const key = `${bought.store}/${bought.productId}`;
        const row = refunded.get(key) ?? {
          store: bought.store,
          productId: bought.productId,
          credits: 0,
        };
        row.credits -= line.delta;
        refunded.set(key, row);
      } else if ((line.reason === 'SPEND' || line.reason === 'SPEND_REVERSED') && line.spendKind) {
        const key = `${line.spendKind}/${line.featureKey ?? ''}/${line.itemKey ?? ''}`;
        const row = spent.get(key) ?? {
          spendKind: line.spendKind,
          featureKey: line.featureKey,
          itemKey: line.itemKey,
          count: 0,
          credits: 0,
        };
        if (line.reason === 'SPEND') {
          row.count += line.quantity ?? 1;
          row.credits -= line.delta;
        } else {
          row.count -= 1;
          row.credits -= line.delta;
        }
        spent.set(key, row);
      }
    }
    const order = ['FEATURE', 'COSMETIC', 'LOOK'];
    return ok({
      purchases: [...purchases.values()].sort(
        (a, b) => a.store.localeCompare(b.store) || a.productId.localeCompare(b.productId),
      ),
      refunded: [...refunded.values()]
        .filter((row) => row.credits > 0)
        .sort((a, b) => a.store.localeCompare(b.store) || a.productId.localeCompare(b.productId)),
      spent: [...spent.values()].sort(
        (a, b) =>
          order.indexOf(a.spendKind) - order.indexOf(b.spendKind) ||
          (a.featureKey ?? a.itemKey ?? '').localeCompare(b.featureKey ?? b.itemKey ?? ''),
      ),
    });
  }),
};
