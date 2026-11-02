import {
  type CreditProduct,
  creditProductKey,
  listAllCreditProducts,
} from '../../services/credits';

/** The pack is not what the list showed any more: someone else changed (or removed) it. */
export class PackChangedError extends Error {
  constructor() {
    super('the credit pack changed since the list was read');
    this.name = 'PackChangedError';
  }
}

const sameSurfaces = (a: CreditProduct['surfaces'], b: CreditProduct['surfaces']) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A pack is saved as a whole (credits, order, sale switch and the surfaces it already had), so a
 * save from a list that has gone stale would put back the values another administrator just
 * changed. The backend has no version to compare, so the last writer wins: before saving, the pack
 * (found by store and product, there is no id) is read again: if it differs from what the list showed (or is
 * gone), nothing is sent and `PackChangedError` is thrown.
 */
export async function assertPackUnchanged(shown: CreditProduct): Promise<void> {
  const now = (await listAllCreditProducts()).find(
    (pack) => creditProductKey(pack) === creditProductKey(shown),
  );
  if (
    !now ||
    now.credits !== shown.credits ||
    now.enabled !== shown.enabled ||
    now.sortOrder !== shown.sortOrder ||
    !sameSurfaces(now.surfaces, shown.surfaces)
  ) {
    throw new PackChangedError();
  }
}
