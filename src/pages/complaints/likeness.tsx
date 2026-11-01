import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Card, Tag, theme } from 'antd';
import { useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  CLOSED_COMPLAINT_STATUSES,
  COMPLAINT_FILTER_STATUSES,
  type Complaint,
  type ComplaintStatusFilter,
  listComplaints,
} from '../../services/complaints';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { ConfigForm } from '../config/ConfigForm';
import { adminLabel, ComplaintDrawer } from './ComplaintDrawer';
import { statusOptions } from './statusOptions';

type Filter = { status?: ComplaintStatusFilter };

/** A complaint that is past its due time and not closed. */
export const isOverdue = (row: Complaint): boolean =>
  row.overdue === true && !CLOSED_COMPLAINT_STATUSES.includes(row.status);

/** 照片里的人投诉 (`COMPLAINT:VIEW`): people who say a photo of them was used for an avatar. Open complaints past their due time are marked. */
export default function LikenessComplaintsPage() {
  const intl = useIntl();
  const { token } = theme.useToken();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [opened, setOpened] = useState<string | null>(null);
  const options = statusOptions(intl);
  const when = (iso: string | null | undefined) => (iso ? formatInstant(iso, intl.locale) : DASH);

  /** Every cell of an overdue row gets the same background, so that the whole row stands out. */
  const mark = (row: Complaint) =>
    isOverdue(row)
      ? { className: 'complaint-overdue', style: { backgroundColor: token.colorErrorBg } }
      : {};

  const columns: ProColumns<Complaint>[] = [
    {
      title: t('complaints.col.id'),
      dataIndex: 'id',
      search: false,
      onCell: mark,
      render: (_, row) => <EllipsisPopoverText text={row.id} lines={1} width={200} />,
    },
    {
      title: t('complaints.col.contactEmail'),
      dataIndex: 'contactEmail',
      search: false,
      onCell: mark,
      render: (_, row) => <EllipsisPopoverText text={row.contactEmail} lines={1} width={220} />,
    },
    {
      title: t('complaints.col.receivedAt'),
      dataIndex: 'receivedAt',
      search: false,
      onCell: mark,
      render: (_, row) => when(row.receivedAt),
    },
    {
      title: t('complaints.col.dueAt'),
      dataIndex: 'dueAt',
      search: false,
      onCell: mark,
      render: (_, row) => (
        <>
          {when(row.dueAt)}
          {isOverdue(row) ? (
            <Tag color="red" style={{ marginInlineStart: 8 }}>
              {t('complaints.overdue')}
            </Tag>
          ) : null}
        </>
      ),
    },
    {
      title: t('complaints.col.status'),
      dataIndex: 'status',
      valueType: 'select',
      // "Not closed" comes first and is not the default: the list opens with no state asked for.
      valueEnum: Object.fromEntries(
        COMPLAINT_FILTER_STATUSES.map((status) => [
          status,
          { text: status === 'OPEN' ? t('complaints.filter.OPEN') : options[status].label },
        ]),
      ),
      onCell: mark,
      render: (_, row) => <StatusTag status={row.status} options={options} />,
    },
    {
      title: t('complaints.col.handledBy'),
      dataIndex: 'handledBy',
      search: false,
      onCell: mark,
      render: (_, row) => adminLabel(row.handledByUsername, row.handledBy),
    },
    {
      title: t('complaints.col.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      onCell: mark,
      render: (_, row) => {
        const actions: RowAction[] = [
          { key: 'detail', label: t('complaints.detail'), onClick: () => setOpened(row.id) },
        ];
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        title={t('complaints.findNote')}
      />
      <PagedListTable<Complaint, Filter>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize, status }) => listComplaints({ page, pageSize, status })}
      />
      <ComplaintDrawer
        id={opened}
        onClose={() => setOpened(null)}
        onChanged={() => ref.current?.reload()}
      />
      <Can code="COMPLAINT:MANAGE">
        <Card title={t('complaints.params')} style={{ marginTop: 16 }}>
          <ConfigForm editPermission="COMPLAINT:MANAGE" />
        </Card>
      </Can>
    </>
  );
}
