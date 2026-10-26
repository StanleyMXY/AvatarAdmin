import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { PagedListTable } from '../../components/PagedListTable';
import {
  type CreditTransaction,
  LEDGER_REASONS,
  listCreditTransactions,
} from '../../services/credits';
import { trimSpec } from '../../utils/trimSpec';
import { utcDayRangeToInstants } from '../../utils/utcDay';
import { AccountLink } from './AccountLink';
import { ledgerColumns, reasonText } from './ledgerColumns';

// The search-only columns (type, range) have no field in the row.
type Row = CreditTransaction & { type?: never; range?: never };

type Filters = {
  accountId?: string;
  reason?: string;
  type?: string;
  fromDay?: string;
  toDay?: string;
};

/** 额度流水: the ledger of every account, newest first (`SUBSCRIPTION:VIEW`). */
export default function CreditTransactionsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const reasonEnum = Object.fromEntries(
    LEDGER_REASONS.map((code) => [code, { text: reasonText(t, intl.messages, code) }]),
  );
  const columns: ProColumns<Row>[] = [
    { title: t('credits.ledger.id'), dataIndex: 'id', search: false },
    {
      title: t('credits.common.accountId'),
      dataIndex: 'accountId',
      render: (_, row) => <AccountLink accountId={row.accountId} />,
    },
    ...ledgerColumns<Row>(t, intl.messages, intl.locale, { withPurchase: false }).map((column) =>
      column.dataIndex === 'reason'
        ? { ...column, search: undefined, valueType: 'select' as const, valueEnum: reasonEnum }
        : column,
    ),
    {
      title: t('credits.transactions.type'),
      dataIndex: 'type',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        all: { text: t('credits.transactions.type.all') },
        earn: { text: t('credits.transactions.type.earn') },
        spend: { text: t('credits.transactions.type.spend') },
      },
    },
    {
      title: t('credits.transactions.range'),
      dataIndex: 'range',
      hideInTable: true,
      valueType: 'dateRange',
      search: {
        transform: (value: [string, string]) => ({ fromDay: value[0], toDay: value[1] }),
      },
    },
  ];

  const request = ({
    page,
    pageSize,
    accountId,
    reason,
    type,
    fromDay,
    toDay,
  }: { page: number; pageSize: number } & Filters) => {
    // The account id is matched exactly by the backend: it goes as typed, whole, only the ends cleaned.
    const id = trimSpec(accountId ?? '');
    const range = fromDay && toDay ? utcDayRangeToInstants(fromDay, toDay) : undefined;
    return listCreditTransactions({
      page,
      pageSize,
      ...(id ? { accountId: id } : {}),
      ...(reason ? { reason } : {}),
      ...(type === 'earn' || type === 'spend' ? { type } : {}),
      ...(range ?? {}),
    });
  };

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t('credits.transactions.rangeNote')}</Typography.Text>
      <PagedListTable<Row, Filters> rowKey="id" columns={columns} request={request} />
    </Flex>
  );
}
