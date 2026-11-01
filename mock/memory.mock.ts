import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { DEFAULT_TEI_HOSTS, type ModelRow, memoryStore, type TierRow } from './_core/memoryData';
import { store } from './_core/store';
import { usersState } from './_core/usersData';

type Detail = { ref: string; reason: string };

/** How many assignments the answer of an account lists, the newest first. */
const MAX_ASSIGNMENTS = 200;

const NAME_RULE = /^[A-Za-z0-9_-]{1,64}$/;

const nameParam = (params: Record<string, string>): string => params.name ?? '';

/** Names go into the URL path, so the backend limits them (contract 16, name rule). */
function checkName(name: string): void {
  if (!NAME_RULE.test(name)) {
    throw invalidRequest('the name may use letters, digits, underscore and hyphen, 1 to 64', [
      { ref: 'name', reason: 'INVALID_PATH' },
    ]);
  }
}

function checkServiceUp(): void {
  if (memoryStore.serviceDown) {
    throw new MockHttpError(502, 'MEMORY_SERVICE_ERROR', 'The memory service did not answer');
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** The ranges of the memory service (contract 16.1); the types are strict: no numbers as text, no null. */
const INT_FIELDS = [
  ['topK', 1, 100],
  ['recencyChannelCount', 0, 100],
  ['consolidationThreshold', 1, 100000],
] as const;
const BOOL_FIELDS = ['recencyChannelEnabled', 'consolidationEnabled'] as const;

function tierProblems(body: Record<string, unknown>): Detail[] {
  const found: Detail[] = [];
  for (const [field, min, max] of INT_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (!isInt(value)) found.push({ ref: field, reason: 'NOT_AN_INTEGER' });
    else if (value < min || value > max) found.push({ ref: field, reason: 'OUT_OF_RANGE' });
  }
  for (const field of BOOL_FIELDS) {
    if (field in body && typeof body[field] !== 'boolean') {
      found.push({ ref: field, reason: 'NOT_BOOLEAN' });
    }
  }
  return found;
}

const allowedHosts = (): string[] => {
  const configured = currentValue('memory.tei_allowed_hosts');
  return Array.isArray(configured) && configured.every((h) => typeof h === 'string')
    ? (configured as string[])
    : DEFAULT_TEI_HOSTS;
};

function modelProblems(body: Record<string, unknown>): Detail[] {
  const found: Detail[] = [];
  const address = body.teiBaseUrl;
  let url: URL | null = null;
  try {
    url = typeof address === 'string' ? new URL(address) : null;
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    found.push({ ref: 'teiBaseUrl', reason: 'NOT_HTTPS' });
  } else if (url.username || url.password || !allowedHosts().includes(url.hostname)) {
    found.push({ ref: 'teiBaseUrl', reason: 'INVALID_HOST' });
  }
  const dimensions = body.dimensions;
  if (!isInt(dimensions)) found.push({ ref: 'dimensions', reason: 'NOT_AN_INTEGER' });
  else if (dimensions < 1 || dimensions > 8192)
    found.push({ ref: 'dimensions', reason: 'OUT_OF_RANGE' });
  return found;
}

const refuse = (message: string, details: Detail[]) => invalidRequest(message, details);

const tierRows = (): TierRow[] =>
  [...memoryStore.tiers.values()].sort((a, b) =>
    a.tierName === 'default' ? -1 : b.tierName === 'default' ? 1 : a.tierName < b.tierName ? -1 : 1,
  );

const usernameOf = (adminId: string): string | null => store.admins.get(adminId)?.username ?? null;

export default {
  'GET /api/admin/memory/tiers': guard('MEMORY:VIEW', () => ok({ items: tierRows() })),

  'GET /api/admin/memory/tiers/:name': guard('MEMORY:VIEW', (req) => {
    const tier = memoryStore.tiers.get(nameParam(req.params));
    if (!tier) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such tier');
    return ok(tier);
  }),

  // A name that is not there creates the tier; settings left out are taken from the default tier
  // (contract 16.2). The memory service is asked first, so a failure changes nothing.
  'PUT /api/admin/memory/tiers/:name': guard('MEMORY:TIER_CONFIG', (req) => {
    const name = nameParam(req.params);
    checkName(name);
    const body = bodyOf(req);
    const problems = tierProblems(body);
    if (problems.length > 0) throw refuse('a tier setting is not valid', problems);
    checkServiceUp();
    const base = memoryStore.tiers.get(name) ?? memoryStore.tiers.get('default');
    const next: TierRow = {
      tierName: name,
      topK: base?.topK ?? 5,
      recencyChannelEnabled: base?.recencyChannelEnabled ?? true,
      recencyChannelCount: base?.recencyChannelCount ?? 3,
      consolidationEnabled: base?.consolidationEnabled ?? false,
      consolidationThreshold: base?.consolidationThreshold ?? 200,
    };
    for (const [field] of INT_FIELDS) if (field in body) next[field] = body[field] as number;
    for (const field of BOOL_FIELDS) if (field in body) next[field] = body[field] as boolean;
    memoryStore.tiers.set(name, next);
    return ok(next);
  }),

  'GET /api/admin/memory/embedding-models': guard('MEMORY:VIEW', () =>
    ok({ items: [...memoryStore.models.values()] }),
  ),

  'PUT /api/admin/memory/embedding-models/:name': guard('MEMORY:MODEL_REGISTER', (req) => {
    const name = nameParam(req.params);
    const body = bodyOf(req);
    const problems = [
      ...(NAME_RULE.test(name) ? [] : [{ ref: 'name', reason: 'INVALID_PATH' }]),
      ...modelProblems(body),
    ];
    if (problems.length > 0) throw refuse('the model is not valid', problems);
    checkServiceUp();
    const existing = memoryStore.models.get(name);
    if (existing && existing.dimensions !== body.dimensions) {
      // the memory service's own sentence, which the page shows as it is
      throw new MockHttpError(
        409,
        'MEMORY_MODEL_CONFLICT',
        'The model is registered with other dimensions',
        {
          detail: `Model ${name} is already registered with ${existing.dimensions} dimensions; its vector table cannot change, register a new name instead`,
        },
      );
    }
    const row: ModelRow = {
      modelName: name,
      teiBaseUrl: body.teiBaseUrl as string,
      dimensions: body.dimensions as number,
    };
    memoryStore.models.set(name, row);
    return ok(row);
  }),

  'GET /api/admin/accounts/:id/memory': guard('MEMORY:VIEW', (req) => {
    const id = req.params.id ?? '';
    // An account of the user module that was never given a model has no tier and no history yet.
    const account =
      memoryStore.accounts.get(id) ??
      (usersState.users.some((u) => u.id === id)
        ? {
            id,
            status: 'ACTIVE' as const,
            tier: {
              tierName: null,
              syncStatus: 'PENDING' as const,
              assignedAt: null,
              lastError: null,
            },
            assignments: [],
          }
        : undefined);
    if (!account) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');
    // The newest 200 assignments, newest first; `truncated` says there are more and `totalCount`
    // how many there are in all (backend answer of 2026-10-31).
    const newest = [...account.assignments].sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1));
    return ok({
      tier: account.tier,
      embeddingAssignments: newest
        .slice(0, MAX_ASSIGNMENTS)
        .map((a) => ({ ...a, assignedByUsername: usernameOf(a.assignedBy) })),
      truncated: newest.length > MAX_ASSIGNMENTS,
      totalCount: newest.length,
    });
  }),

  // Contract 17.3, account state table: refused for an account waiting for deletion or being deleted.
  'PUT /api/admin/accounts/:id/memory/embedding-model': guard('MEMORY:MODEL_ASSIGN', (req) => {
    const account = memoryStore.accounts.get(req.params.id ?? '');
    if (!account) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');
    if (account.status === 'PENDING_DELETION') {
      throw new MockHttpError(
        403,
        'ACCOUNT_DELETION_SCHEDULED',
        'The account is waiting for deletion',
      );
    }
    if (account.status === 'DELETING') {
      throw new MockHttpError(403, 'ACCOUNT_DELETING', 'The account is being deleted');
    }
    const modelName = bodyOf(req).modelName;
    if (typeof modelName !== 'string' || modelName.trim() === '') {
      throw refuse('modelName is required', [{ ref: 'modelName', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    if (!memoryStore.models.has(modelName)) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such embedding model');
    }
    checkServiceUp();
    account.assignments.push({
      modelName,
      assignedBy: req.admin.id,
      assignedAt: new Date().toISOString(),
    });
    return ok(null);
  }),
};
