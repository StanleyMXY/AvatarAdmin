import { Link, useIntl } from '@umijs/max';
import { Tag } from 'antd';
import { plainText } from '../../utils/plainText';
import { isGuest } from './format';

/**
 * The account of a session: the account id as a link to the user detail, or "Guest" with no link
 * for a guest session. The id can be any text, so it is broken anywhere and cut to two lines: it
 * cannot make a table or a drawer wider (the whole id is the tooltip).
 */
export function AccountCell({ accountId }: { accountId: unknown }) {
  const intl = useIntl();
  if (isGuest(accountId)) {
    return <Tag>{intl.formatMessage({ id: 'sessions.common.guest' })}</Tag>;
  }
  const id = plainText(accountId);
  return (
    <Link
      to={`/users/${encodeURIComponent(id)}`}
      title={id}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        maxWidth: 320,
        overflowWrap: 'anywhere',
        wordBreak: 'break-all',
      }}
    >
      {id}
    </Link>
  );
}
