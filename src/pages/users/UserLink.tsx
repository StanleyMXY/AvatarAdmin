import { Link } from '@umijs/max';
import { plainText } from '../../utils/plainText';

/**
 * An account id that opens the user detail. The id can be any text, so it is broken anywhere and cut
 * to two lines: nothing makes a table wider or taller (the whole id is the tooltip).
 */
export function UserLink({ accountId, tab }: { accountId: unknown; tab?: string }) {
  const id = plainText(accountId);
  return (
    <Link
      to={`/users/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`}
      title={id}
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
      {id}
    </Link>
  );
}
