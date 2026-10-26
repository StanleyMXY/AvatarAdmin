import { Link } from '@umijs/max';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/**
 * An account id that opens the user detail. The id can be any text, so it is broken anywhere: nothing
 * makes the table wider. No account is a dash.
 */
export function AccountLink({ accountId }: { accountId: unknown }) {
  const id = plainText(accountId);
  if (id === '') return <span>{DASH}</span>;
  return (
    <Link to={`/users/${encodeURIComponent(id)}`} title={id} style={{ overflowWrap: 'anywhere' }}>
      {id}
    </Link>
  );
}
