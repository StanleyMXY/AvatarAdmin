import { Link } from '@umijs/max';

/**
 * An account id that opens the credit tab of the user detail. The id can be any text, so it is
 * broken anywhere and cut to two lines: nothing makes the table wider or taller (the whole id is the tooltip).
 */
export function AccountLink({ accountId }: { accountId: string }) {
  return (
    <Link
      to={`/users/${encodeURIComponent(accountId)}?tab=credits`}
      title={accountId}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        maxWidth: 260,
        overflowWrap: 'anywhere',
        wordBreak: 'break-all',
      }}
    >
      {accountId}
    </Link>
  );
}
