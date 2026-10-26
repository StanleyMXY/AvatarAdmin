import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Button, Flex, Typography } from 'antd';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { listSessions, type SessionRow } from '../../services/sessions';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { utcDayRangeToInstants } from '../../utils/utcDay';
import { AccountCell } from './AccountCell';
import { devicePrefix, formatDuration, when } from './format';
import { SessionDrawer } from './SessionDrawer';

// The search-only columns have no field in the row.
type Row = SessionRow & {
  accountQuery?: never;
  guest?: never;
  ongoing?: never;
  deadline?: never;
  range?: never;
};

type Filters = {
  accountQuery?: string;
  guest?: string;
  ongoing?: string;
  deadline?: string;
  fromDay?: string;
  toDay?: string;
};

const bool = (value: string | undefined): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined;

/**
 * 会话列表 (`SESSION:VIEW`): every call, guest calls included, newest request first. A guest session
 * shows "Guest" with no link and its device by the first 8 characters; an account session links its
 * account id to the user detail. The session id opens the details in a drawer.
 */
export default function SessionListPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [openId, setOpenId] = useState<string | null>(null);

  const yesNo = (only?: 'yes') => ({
    ...(only === 'yes' ? {} : { false: { text: t('sessions.common.no') } }),
    true: { text: t('sessions.common.yes') },
  });
  const text = (value: unknown) => {
    const shown = plainText(value);
    return shown === '' ? DASH : <EllipsisPopoverText text={shown} lines={2} width={200} />;
  };

  const columns: ProColumns<Row>[] = [
    {
      title: t('sessions.list.col.id'),
      dataIndex: 'id',
      search: false,
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => setOpenId(String(row.id))}
          style={{
            height: 'auto',
            padding: 0,
            textAlign: 'start',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-all',
            maxWidth: 220,
          }}
        >
          {plainText(row.id)}
        </Button>
      ),
    },
    {
      title: t('sessions.list.col.accountId'),
      dataIndex: 'accountId',
      search: false,
      render: (_, row) => <AccountCell accountId={row.accountId} />,
    },
    {
      title: t('sessions.list.col.device'),
      dataIndex: 'deviceId',
      search: false,
      render: (_, row) => devicePrefix(row.deviceId) || DASH,
    },
    {
      title: t('sessions.list.col.requestedAt'),
      dataIndex: 'requestedAt',
      search: false,
      render: (_, row) => when(row.requestedAt, intl.locale),
    },
    {
      title: t('sessions.list.col.startedAt'),
      dataIndex: 'startedAt',
      search: false,
      render: (_, row) => when(row.startedAt, intl.locale),
    },
    {
      title: t('sessions.list.col.endedAt'),
      dataIndex: 'endedAt',
      search: false,
      render: (_, row) => when(row.endedAt, intl.locale),
    },
    {
      title: t('sessions.list.col.duration'),
      dataIndex: 'durationSeconds',
      search: false,
      align: 'right',
      render: (_, row) =>
        typeof row.durationSeconds === 'number'
          ? formatDuration(row.durationSeconds, t)
          : plainText(row.endedAt) === ''
            ? t('sessions.ongoing')
            : DASH,
    },
    {
      title: t('sessions.list.col.modelTier'),
      dataIndex: 'modelTier',
      search: false,
      render: (_, row) => text(row.modelTier),
    },
    {
      title: t('sessions.list.col.language'),
      dataIndex: 'language',
      search: false,
      render: (_, row) => text(row.language),
    },
    {
      title: t('sessions.list.col.accountId'),
      dataIndex: 'accountQuery',
      hideInTable: true,
    },
    {
      title: t('sessions.list.filter.guest'),
      dataIndex: 'guest',
      hideInTable: true,
      valueType: 'select',
      valueEnum: yesNo(),
    },
    {
      title: t('sessions.list.filter.ongoing'),
      dataIndex: 'ongoing',
      hideInTable: true,
      valueType: 'select',
      valueEnum: yesNo(),
    },
    {
      title: t('sessions.list.filter.deadline'),
      dataIndex: 'deadline',
      hideInTable: true,
      valueType: 'select',
      // Only "yes" can be asked: the backend filters `endReason=DEADLINE`, not "any other reason".
      valueEnum: { DEADLINE: { text: t('sessions.common.yes') } },
    },
    {
      title: t('sessions.list.filter.range'),
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
    accountQuery,
    guest,
    ongoing,
    deadline,
    fromDay,
    toDay,
  }: { page: number; pageSize: number } & Filters) => {
    // The account id is matched whole by the backend: it goes as typed, only the ends cleaned.
    const accountId = trimSpec(accountQuery ?? '');
    const range = fromDay && toDay ? utcDayRangeToInstants(fromDay, toDay) : undefined;
    const guestFlag = bool(guest);
    const ongoingFlag = bool(ongoing);
    return listSessions({
      page,
      pageSize,
      ...(accountId ? { accountId } : {}),
      ...(guestFlag === undefined ? {} : { guest: guestFlag }),
      ...(range ?? {}),
      ...(ongoingFlag === undefined ? {} : { ongoing: ongoingFlag }),
      ...(deadline === 'DEADLINE' ? { endReason: 'DEADLINE' as const } : {}),
    });
  };

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t('sessions.list.note')}</Typography.Text>
      <Typography.Text type="secondary">{t('sessions.list.rangeNote')}</Typography.Text>
      <PagedListTable<Row, Filters> rowKey="id" columns={columns} request={request} />
      <SessionDrawer id={openId} onClose={() => setOpenId(null)} />
    </Flex>
  );
}
