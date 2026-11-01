import { describeFailure } from '../../session/describe';

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

/** The names of the fields of the chain query, as the backend calls them in `details`, and the text of each. */
const FIELD_LABELS: Record<string, string> = {
  rootAccountId: 'invite.chain.accountId',
  maxDepth: 'invite.chain.depth',
};

/**
 * The words of a failed chain request: the general words of the error code, then one sentence per
 * field the backend named ("Depth: The value is outside the allowed range."), so that a limit that
 * another administrator has lowered since this page was opened says which field and why. The
 * backend's own message is not shown. A field this page has no name for gives its reason alone.
 */
export function chainFailureText(
  intl: Parameters<typeof describeFailure>[0],
  failure: unknown,
): string {
  const { text, fields } = describeFailure(intl, failure);
  const lines = fields.map((field) => {
    const label = FIELD_LABELS[field.ref];
    return label
      ? intl.formatMessage(
          { id: 'invite.chain.fieldFailure' },
          { field: intl.formatMessage({ id: label }), reason: field.text },
        )
      : field.text;
  });
  return lines.length === 0 ? text : `${text} ${lines.join(' ')}`;
}
