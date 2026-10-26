// State of the memory service in the mock backend: the tiers, the embedding models and a few
// accounts with their tier and the history of model assignments. It hangs on `globalThis`, like the
// rest of the mock state, so saving a mock file does not lose it; `resetMemoryStore` puts the
// sample data back (tests call it).
import { daysAgoIso } from './fixtures';
import { findAdminByUsername } from './store';

export type TierRow = {
  tierName: string;
  topK: number;
  recencyChannelEnabled: boolean;
  recencyChannelCount: number;
  consolidationEnabled: boolean;
  consolidationThreshold: number;
};

export type ModelRow = { modelName: string; teiBaseUrl: string; dimensions: number };

export type AssignmentRow = { modelName: string; assignedBy: string; assignedAt: string };

export type AccountStatus = 'ACTIVE' | 'BANNED' | 'PENDING_DELETION' | 'DELETING';

export type AccountRow = {
  id: string;
  status: AccountStatus;
  tier: {
    tierName: string | null;
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    assignedAt: string | null;
    lastError: string | null;
  };
  assignments: AssignmentRow[];
};

type MemoryStore = {
  tiers: Map<string, TierRow>;
  models: Map<string, ModelRow>;
  accounts: Map<string, AccountRow>;
  /** Set by a test (or by hand) to make every write answer 502 MEMORY_SERVICE_ERROR. */
  serviceDown: boolean;
};

/** The sample accounts, by what makes each of them interesting. */
export const MEMORY_ACCOUNT_IDS = {
  active: '2001',
  failedSync: '2002',
  pendingDeletion: '2003',
  deleting: '2004',
  banned: '2005',
} as const;

/** The hosts the registration of a model accepts when `memory.tei_allowed_hosts` is not set. */
export const DEFAULT_TEI_HOSTS = ['tei.internal.example'];

const holder = globalThis as { __avatarAdminMockMemory?: MemoryStore };
holder.__avatarAdminMockMemory ??= {
  tiers: new Map(),
  models: new Map(),
  accounts: new Map(),
  serviceDown: false,
};

export const memoryStore: MemoryStore = holder.__avatarAdminMockMemory;

export function resetMemoryStore(): void {
  const rootId = findAdminByUsername('root')?.id ?? '1001';
  memoryStore.serviceDown = false;
  memoryStore.tiers.clear();
  memoryStore.models.clear();
  memoryStore.accounts.clear();
  for (const tier of [
    {
      tierName: 'default',
      topK: 5,
      recencyChannelEnabled: true,
      recencyChannelCount: 3,
      consolidationEnabled: false,
      consolidationThreshold: 200,
    },
    {
      tierName: 'premium',
      topK: 10,
      recencyChannelEnabled: true,
      recencyChannelCount: 5,
      consolidationEnabled: true,
      consolidationThreshold: 500,
    },
  ] satisfies TierRow[])
    memoryStore.tiers.set(tier.tierName, tier);
  memoryStore.models.set('bge-m3', {
    modelName: 'bge-m3',
    teiBaseUrl: 'https://tei.internal.example',
    dimensions: 1024,
  });

  const account = (
    id: string,
    status: AccountStatus,
    tier: AccountRow['tier'],
    assignments: AssignmentRow[] = [],
  ) => memoryStore.accounts.set(id, { id, status, tier, assignments });
  const synced = (tierName: string) => ({
    tierName,
    syncStatus: 'SYNCED' as const,
    assignedAt: daysAgoIso(2),
    lastError: null,
  });
  account(MEMORY_ACCOUNT_IDS.active, 'ACTIVE', synced('premium'), [
    { modelName: 'bge-m3', assignedBy: rootId, assignedAt: daysAgoIso(10) },
  ]);
  account(
    MEMORY_ACCOUNT_IDS.failedSync,
    'ACTIVE',
    {
      tierName: 'premium',
      syncStatus: 'FAILED',
      assignedAt: daysAgoIso(5),
      lastError: 'the memory service answered 404: tier premium not found',
    },
    // an administrator who has been deleted since: the ID stays, the name is null
    [{ modelName: 'bge-m3', assignedBy: '9999', assignedAt: daysAgoIso(30) }],
  );
  account(MEMORY_ACCOUNT_IDS.pendingDeletion, 'PENDING_DELETION', synced('default'));
  account(MEMORY_ACCOUNT_IDS.deleting, 'DELETING', synced('default'));
  account(MEMORY_ACCOUNT_IDS.banned, 'BANNED', {
    tierName: null,
    syncStatus: 'PENDING',
    assignedAt: null,
    lastError: null,
  });
}

resetMemoryStore();
