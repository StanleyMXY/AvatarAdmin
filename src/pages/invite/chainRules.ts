/** The depth the chain query starts at when nothing else is chosen. */
export const DEFAULT_CHAIN_DEPTH = 3;

/** The configured upper limit (`inviteChainMaxDepth` of `GET /meta`) when it is a whole number of 1 or more, else null (not known). */
export const depthLimit = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;

/** 3, or the limit when that is smaller. */
export const defaultDepth = (limit: number | null): number =>
  limit === null ? DEFAULT_CHAIN_DEPTH : Math.min(DEFAULT_CHAIN_DEPTH, limit);

/** A whole number from 1 to the limit; without a known limit there is no upper bound here (the backend decides). */
export function checkDepth(value: unknown, limit: number | null): boolean {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return false;
  return limit === null || value <= limit;
}
