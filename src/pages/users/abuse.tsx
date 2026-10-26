import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, InputNumber, type TableColumnsType, Tabs, Typography } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { StatusTag } from '../../components/StatusTag';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import {
  type AbuseBy,
  type AbuseCluster,
  type ClusterAccount,
  listAbuseClusters,
  listClusterAccounts,
  USER_STATUSES,
} from '../../services/users';
import { useAdminMeta } from '../../session/useSession';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { lastNDaysUtc, utcDayRangeToInstants } from '../../utils/utcDay';
import { BanUserModal } from './BanUserModal';
import { ServerTable } from './ServerTable';
import { STATUS_COLORS } from './statusColors';
import { countText, labelOf } from './text';
import { UserLink } from './UserLink';

type Query = { range: DayRange; minFree: number | null };

const when = (value: unknown, locale: string) => {
  const text = plainText(value);
  return text === '' ? DASH : formatInstant(text, locale);
};

/** The accounts of one cluster, with a ban button on the free ones (`USER:BAN`; a paid account is never acted on). */
function ClusterAccounts({ by, clusterKey }: { by: AbuseBy; clusterKey: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const reloadRef = useRef<(() => void) | null>(null);
  const load = useCallback(
    (paging: { page: number; pageSize: number }) =>
      listClusterAccounts({ by, key: clusterKey, ...paging }),
    [by, clusterKey],
  );
  const statusOptions = Object.fromEntries(
    USER_STATUSES.map((status) => [
      status,
      { label: labelOf(intl, 'users.status', status), color: STATUS_COLORS[status] },
    ]),
  );
  const columns: TableColumnsType<ClusterAccount> = [
    {
      title: t('users.common.accountId'),
      render: (_, row) => <UserLink accountId={row.accountId} />,
    },
    { title: t('users.common.createdAt'), render: (_, row) => when(row.createdAt, intl.locale) },
    {
      title: t('users.common.status'),
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      title: t('users.abuse.paidColumn'),
      render: (_, row) => t(row.paid === true ? 'users.common.yes' : 'users.common.no'),
    },
    {
      title: t('users.abuse.method'),
      render: (_, row) => labelOf(intl, 'users.method', row.registerMethod),
    },
    {
      title: t('users.common.actions'),
      render: (_, row) =>
        row.paid === true ? null : (
          <BanUserModal
            compact
            accountId={plainText(row.accountId)}
            status={plainText(row.status)}
            onDone={() => reloadRef.current?.()}
          />
        ),
    },
  ];
  return (
    <ServerTable<ClusterAccount>
      rowKey="accountId"
      columns={columns}
      load={load}
      reloadRef={reloadRef}
    />
  );
}

/**
 * 多开检测 (`ABUSE:VIEW`): clusters of accounts created from one device or one IP in a range of UTC
 * days, with at least the chosen number of free accounts (empty means the server's default, which is
 * then not sent). A cluster opens to its accounts; a free account has a ban button, a paid one does not.
 */
export default function AbusePage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const serverDefault =
    typeof meta.abuseClusterMinFreeAccounts === 'number' &&
    Number.isFinite(meta.abuseClusterMinFreeAccounts)
      ? meta.abuseClusterMinFreeAccounts
      : null;
  const [by, setBy] = useState<AbuseBy>('DEVICE');
  const [draft, setDraft] = useState<Query>(() => ({ range: lastNDaysUtc(7), minFree: null }));
  // What the table asks is what was searched, not what is being typed.
  const [searched, setSearched] = useState<Query>(draft);

  const load = useCallback(
    (paging: { page: number; pageSize: number }) => {
      const range = utcDayRangeToInstants(searched.range.from, searched.range.to);
      return listAbuseClusters({
        by,
        from: range.from,
        to: range.to,
        ...(searched.minFree === null ? {} : { minFreeAccounts: searched.minFree }),
        ...paging,
      });
    },
    [by, searched],
  );

  const columns: TableColumnsType<AbuseCluster> = [
    {
      title: t('users.abuse.key'),
      render: (_, row) => <Typography.Text code>{plainText(row.key).slice(0, 8)}</Typography.Text>,
    },
    {
      title: t('users.abuse.accounts'),
      align: 'right',
      render: (_, row) => countText(row.accounts, intl.locale),
    },
    {
      title: t('users.abuse.free'),
      align: 'right',
      render: (_, row) => countText(row.freeAccounts, intl.locale),
    },
    {
      title: t('users.abuse.paid'),
      align: 'right',
      render: (_, row) => countText(row.paidAccounts, intl.locale),
    },
    {
      title: t('users.abuse.firstCreatedAt'),
      render: (_, row) => when(row.firstCreatedAt, intl.locale),
    },
    {
      title: t('users.abuse.lastCreatedAt'),
      render: (_, row) => when(row.lastCreatedAt, intl.locale),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Alert type="info" showIcon title={t('users.abuse.noteFree')} />
      <Alert type="warning" showIcon title={t('users.abuse.noteIp')} />
      <Tabs
        activeKey={by}
        onChange={(key) => setBy(key === 'IP' ? 'IP' : 'DEVICE')}
        items={[
          { key: 'DEVICE', label: t('users.abuse.byDevice') },
          { key: 'IP', label: t('users.abuse.byIp') },
        ]}
      />
      <Flex gap={16} wrap align="center">
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('users.abuse.range')}</Typography.Text>
          <DateRangeUtc value={draft.range} onChange={(range) => setDraft({ ...draft, range })} />
        </Flex>
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('users.abuse.threshold')}</Typography.Text>
          <InputNumber
            aria-label={t('users.abuse.threshold')}
            min={0}
            precision={0}
            value={draft.minFree}
            placeholder={
              serverDefault === null
                ? t('users.abuse.thresholdServer')
                : t('users.abuse.thresholdDefault', { n: serverDefault })
            }
            onChange={(value) =>
              setDraft({ ...draft, minFree: typeof value === 'number' ? value : null })
            }
            style={{ width: 200 }}
          />
        </Flex>
        <Button type="primary" onClick={() => setSearched(draft)}>
          {t('users.abuse.search')}
        </Button>
      </Flex>
      <ServerTable<AbuseCluster>
        key={`${by}|${searched.range.from}|${searched.range.to}|${searched.minFree}`}
        rowKey="key"
        columns={columns}
        load={load}
        expandedRowRender={(row) => <ClusterAccounts by={by} clusterKey={plainText(row.key)} />}
      />
    </Flex>
  );
}
