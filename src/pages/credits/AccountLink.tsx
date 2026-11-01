import { Link, useAccess } from '@umijs/max';
import type { CSSProperties } from 'react';

const CLAMP: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  maxWidth: 260,
  overflowWrap: 'anywhere',
  wordBreak: 'break-all',
};

/**
 * An account id that opens the credit tab of the user detail for an administrator who may open the
 * user pages (`USER:VIEW`); for anyone else it is plain text, because the link would end on the
 * page that refuses them. The id can be any text, so it is broken anywhere and cut to two lines:
 * nothing makes the table wider or taller (the whole id is the tooltip).
 */
export function AccountLink({ accountId }: { accountId: string }) {
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  if (!access.canAccess('USER:VIEW')) {
    return (
      <span title={accountId} style={CLAMP}>
        {accountId}
      </span>
    );
  }
  return (
    <Link
      to={`/users/${encodeURIComponent(accountId)}?tab=credits`}
      title={accountId}
      style={CLAMP}
    >
      {accountId}
    </Link>
  );
}
