import type { ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { PagedListTable } from '../../components/PagedListTable';
import { StatusTag } from '../../components/StatusTag';
import {
  listUsers,
  TRAFFIC_TYPES,
  USER_STATUSES,
  USERS_EXPORT_URL,
  type UserRow,
} from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { Cell } from './Cell';
import { STATUS_COLORS } from './statusColors';
import { labelOf } from './text';
import { UserLink } from './UserLink';

type Filters = {
  accountId?: string;
  email?: string;
  phone?: string;
  status?: string;
  channelCode?: string;
  trafficType?: string;
  mediaSource?: string;
};

/** The filters that have a value, cleaned at the ends only: the e-mail and the phone number are matched whole by the backend. */
function committedFilters(filters: Filters): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    const text = typeof value === 'string' ? trimSpec(value) : '';
    if (text !== '') kept[key] = text;
  }
  return kept;
}

/**
 * 用户列表 (`USER:VIEW`): the account list with seven filters. The e-mail and phone number are
 * shown as the backend gave them (masked unless the administrator holds `USER:EMAIL_VIEW` /
 * `USER:PHONE_VIEW`). The export (`USER:EXPORT` and `USER:VIEW`) takes the filters of the last search.
 */
export default function UserListPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const [committed, setCommitted] = useState<Record<string, string>>({});
  const masked = !access.canAccess('USER:EMAIL_VIEW') || !access.canAccess('USER:PHONE_VIEW');

  const statusEnum = Object.fromEntries(
    USER_STATUSES.map((status) => [status, { text: labelOf(intl, 'users.status', status) }]),
  );
  const trafficEnum = Object.fromEntries(
    TRAFFIC_TYPES.map((type) => [type, { text: labelOf(intl, 'users.traffic', type) }]),
  );
  const statusOptions = Object.fromEntries(
    USER_STATUSES.map((status) => [
      status,
      { label: labelOf(intl, 'users.status', status), color: STATUS_COLORS[status] },
    ]),
  );

  const columns: ProColumns<UserRow>[] = [
    {
      title: t('users.common.accountId'),
      dataIndex: 'id',
      search: false,
      render: (_, row) => <UserLink accountId={row.id} />,
    },
    {
      title: t('users.common.accountId'),
      dataIndex: 'accountId',
      hideInTable: true,
    },
    {
      title: t('users.list.email'),
      dataIndex: 'email',
      fieldProps: { placeholder: t('users.list.emailPlaceholder') },
      render: (_, row) => <Cell value={row.email} />,
    },
    {
      title: t('users.list.phone'),
      dataIndex: 'phone',
      fieldProps: { placeholder: t('users.list.phonePlaceholder') },
      render: (_, row) => <Cell value={row.phone} />,
    },
    {
      title: t('users.common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: statusEnum,
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      title: t('users.list.channel'),
      dataIndex: 'channelCode',
      render: (_, row) => <Cell value={row.channelCode} />,
    },
    {
      title: t('users.list.traffic'),
      dataIndex: 'trafficType',
      valueType: 'select',
      valueEnum: trafficEnum,
      render: (_, row) => labelOf(intl, 'users.traffic', row.trafficType),
    },
    {
      title: t('users.list.mediaSource'),
      dataIndex: 'mediaSource',
      hideInTable: true,
    },
    {
      title: t('users.common.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => formatInstant(plainText(row.createdAt), intl.locale) || DASH,
    },
    {
      title: t('users.list.timezone'),
      dataIndex: 'timezone',
      search: false,
      render: (_, row) => <Cell value={row.timezone} />,
    },
    {
      title: t('users.list.language'),
      dataIndex: 'conversationLanguage',
      search: false,
      render: (_, row) => <Cell value={row.conversationLanguage} />,
    },
  ];

  const request = ({
    page,
    pageSize,
    ...filters
  }: { page: number; pageSize: number } & Filters) => {
    const kept = committedFilters(filters);
    setCommitted((previous) =>
      JSON.stringify(previous) === JSON.stringify(kept) ? previous : kept,
    );
    return listUsers({ page, pageSize, ...kept });
  };

  return (
    <Flex vertical gap={12}>
      {masked ? (
        <Typography.Text type="secondary">{t('users.list.maskedNote')}</Typography.Text>
      ) : null}
      <PagedListTable<UserRow, Filters>
        rowKey="id"
        columns={columns}
        request={request}
        toolbar={[
          <ExportButton
            key="export"
            name="users"
            url={USERS_EXPORT_URL}
            params={committed}
            viewCode="USER:VIEW"
            requiredCodes={['USER:EXPORT', 'USER:VIEW']}
          />,
        ]}
      />
    </Flex>
  );
}
