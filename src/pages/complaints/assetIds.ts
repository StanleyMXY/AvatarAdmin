import { trimSpec } from '../../utils/trimSpec';

// The avatar IDs of a removal (contract 11.6, `POST /likeness-complaints/{id}/remove-avatars`):
// at most 20, each a UUID string, none twice (a UUID written in another case is the same one).
// The backend refuses anything else with 400 OUT_OF_RANGE; the page keeps the list clean so that
// it never has to ask.

/** The most IDs one removal takes. */
export const ASSET_IDS_MAX = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The 36-character form with hyphens, in either case. */
export const isUuid = (value: string): boolean => UUID.test(value);

/**
 * The IDs typed or pasted for a removal: trimmed with the contract's set, empty ones dropped, and
 * each once (case ignored, the way it was first written kept), in the order first typed.
 */
export const cleanAssetIds = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const id = trimSpec(value);
    if (id === '' || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    kept.push(id);
  }
  return kept;
};
