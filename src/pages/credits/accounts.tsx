import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { PagedListTable } from '../../components/PagedListTable';
import { type CreditAccount, listCreditAccounts } from '../../services/credits';
import { formatInstant } from '../../utils/format';
import { formatCount } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { AccountLink } from './AccountLink';
import { NegativeBalance } from './NegativeBalance';

type Filters = { accountId?: string; balanceMin?: number | null; balanceMax?: number | null };

/** 额度账户: every account that has a credit account, the one updated last first (`SUBSCRIPTION:VIEW`). */
export default function CreditAccountsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const columns: ProColumns<CreditAccount>[] = [
    {
      title: t('credits.common.accountId'),
      dataIndex: 'accountId',
      render: (_, row) => <AccountLink accountId={row.accountId} />,
    },
    {
      title: t('credits.account.balance'),
      dataIndex: 'balance',
      search: false,
      align: 'right',
      render: (_, row) => <NegativeBalance value={row.balance} />,
    },
    {
      title: t('credits.account.totalEarned'),
      dataIndex: 'totalEarned',
      search: false,
      align: 'right',
      render: (_, row) => formatCount(row.totalEarned, intl.locale),
    },
    {
      title: t('credits.account.totalSpent'),
      dataIndex: 'totalSpent',
      search: false,
      align: 'right',
      render: (_, row) => formatCount(row.totalSpent, intl.locale),
    },
    {
      title: t('credits.common.updatedAt'),
      dataIndex: 'updatedAt',
      search: false,
      render: (_, row) => formatInstant(row.updatedAt, intl.locale),
    },
    {
      title: t('credits.accounts.balanceMin'),
      dataIndex: 'balanceMin',
      hideInTable: true,
      valueType: 'digit',
      // ProTable's number box starts at 0 and would turn a negative bound into 0: balances can be negative.
      fieldProps: { precision: 0, min: Number.MIN_SAFE_INTEGER, style: { width: '100%' } },
    },
    {
      title: t('credits.accounts.balanceMax'),
      dataIndex: 'balanceMax',
      hideInTable: true,
      valueType: 'digit',
      // ProTable's number box starts at 0 and would turn a negative bound into 0: balances can be negative.
      fieldProps: { precision: 0, min: Number.MIN_SAFE_INTEGER, style: { width: '100%' } },
    },
  ];

  const request = ({
    page,
    pageSize,
    accountId,
    balanceMin,
    balanceMax,
  }: { page: number; pageSize: number } & Filters) => {
    // Exact match on the backend: the id goes as typed, whole, only the ends cleaned. A balance
    // bound of 0 is a real bound; only an empty box leaves it out.
    const id = trimSpec(accountId ?? '');
    return listCreditAccounts({
      page,
      pageSize,
      ...(id ? { accountId: id } : {}),
      ...(typeof balanceMin === 'number' ? { balanceMin } : {}),
      ...(typeof balanceMax === 'number' ? { balanceMax } : {}),
    });
  };

  return (
    <PagedListTable<CreditAccount, Filters>
      rowKey="accountId"
      columns={columns}
      request={request}
    />
  );
}
