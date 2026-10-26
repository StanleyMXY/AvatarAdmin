import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Flex } from 'antd';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type AuditLog, listAuditLogs } from '../../services/system';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { utcDayRangeToInstants } from '../../utils/utcDay';
import { AuditAdminFilter } from './AuditAdminFilter';
import { detailText } from './auditDetail';
import { adminLabel, instantText, orDash } from './texts';

type Filters = {
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  fromDay?: string;
  toDay?: string;
};

/**
 * 审计日志 (`AUDIT:VIEW`): what the administrators did. Read only: there is no control here that
 * changes or deletes a row. The administrator column shows the name written with the row, never the
 * current name of the account; when the row has no name the first eight characters of the id stand in.
 * The detail has no fixed type, so it goes through `plainText`, and a value that belongs to a credential
 * is hidden (auditDetail.ts); nothing of a row is written to the console.
 */
export default function AuditPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const columns: ProColumns<AuditLog>[] = [
    {
      title: t('system.audit.col.admin'),
      dataIndex: 'adminUsername',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText
          text={adminLabel(row.adminUsername, row.adminId)}
          lines={2}
          width={200}
        />
      ),
    },
    {
      title: t('system.audit.col.admin'),
      dataIndex: 'adminId',
      hideInTable: true,
      formItemRender: () => <AuditAdminFilter />,
    },
    {
      title: t('system.audit.col.action'),
      dataIndex: 'action',
      render: (_, row) => <span style={{ overflowWrap: 'anywhere' }}>{orDash(row.action)}</span>,
    },
    {
      title: t('system.audit.col.targetType'),
      dataIndex: 'targetType',
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{orDash(row.targetType)}</span>
      ),
    },
    {
      title: t('system.audit.col.targetId'),
      dataIndex: 'targetId',
      render: (_, row) => <span style={{ overflowWrap: 'anywhere' }}>{orDash(row.targetId)}</span>,
    },
    {
      title: t('system.audit.col.detail'),
      dataIndex: 'detail',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={detailText(row.detail)} lines={3} width={360} />
      ),
    },
    {
      title: t('system.audit.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    {
      title: t('system.audit.filter.range'),
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
    adminId,
    action,
    targetType,
    targetId,
    fromDay,
    toDay,
  }: { page: number; pageSize: number } & Filters) => {
    // The ids and the names go as typed, whole; only the ends are cleaned.
    const clean = (value: string | undefined) => trimSpec(plainText(value));
    const range = fromDay && toDay ? utcDayRangeToInstants(fromDay, toDay) : undefined;
    return listAuditLogs({
      page,
      pageSize,
      ...(clean(adminId) ? { adminId: clean(adminId) } : {}),
      ...(clean(action) ? { action: clean(action) } : {}),
      ...(clean(targetType) ? { targetType: clean(targetType) } : {}),
      ...(clean(targetId) ? { targetId: clean(targetId) } : {}),
      ...(range ?? {}),
    });
  };

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('system.audit.note')} />
      <PagedListTable<AuditLog, Filters> rowKey="id" columns={columns} request={request} />
    </Flex>
  );
}
