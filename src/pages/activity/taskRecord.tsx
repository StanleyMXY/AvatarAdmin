import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { StatusTag } from '../../components/StatusTag';
import {
  listTaskRecords,
  RECORD_STATUSES,
  type RecordStatus,
  type TaskRecord,
} from '../../services/activity';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { CopyableId } from './CopyableId';
import { countText, instantText, plainOrDash } from './texts';

type Filters = { accountId?: string; status?: RecordStatus };

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: 'processing',
  CLAIMABLE: 'warning',
  REWARDED: 'success',
  EXPIRED: 'default',
};

/** 任务记录 (`TASK:VIEW`): the daily tasks of each account by local day, with progress, state, and credits granted. Read only. */
export default function TaskRecordPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const statusOptions = Object.fromEntries(
    RECORD_STATUSES.map((status) => [
      status,
      { label: t(`activity.taskRecord.status.${status}`), color: STATUS_COLOR[status] },
    ]),
  );

  const columns: ProColumns<TaskRecord>[] = [
    {
      title: t('activity.common.accountId'),
      dataIndex: 'accountId',
      render: (_, row) => <CopyableId value={row.accountId} />,
    },
    {
      title: t('activity.taskRecord.col.task'),
      dataIndex: 'taskName',
      search: false,
      render: (_, row) => {
        const name = plainText(row.taskName);
        // The name now; a task that is gone has none, and then the id is all there is to show.
        return name === '' ? (
          <Flex vertical gap={0}>
            <span>{DASH}</span>
            <Typography.Text type="secondary">
              {t('activity.taskRecord.idOf', { id: plainOrDash(row.taskId) })}
            </Typography.Text>
          </Flex>
        ) : (
          <EllipsisPopoverText text={name} lines={2} width={240} />
        );
      },
    },
    {
      title: t('activity.taskRecord.col.date'),
      dataIndex: 'taskDate',
      search: false,
      render: (_, row) => plainOrDash(row.taskDate),
    },
    {
      title: t('activity.taskRecord.col.progress'),
      dataIndex: 'currentProgress',
      search: false,
      align: 'end',
      render: (_, row) =>
        t('activity.taskRecord.progress', {
          current: countText(intl.locale, row.currentProgress),
          target: countText(intl.locale, row.targetValue),
        }),
    },
    {
      title: t('activity.taskRecord.col.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        RECORD_STATUSES.map((status) => [
          status,
          { text: t(`activity.taskRecord.status.${status}`) },
        ]),
      ),
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      title: t('activity.taskRecord.col.completedAt'),
      dataIndex: 'completedAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.completedAt),
    },
    {
      title: t('activity.taskRecord.col.rewardedAt'),
      dataIndex: 'rewardedAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.rewardedAt),
    },
    {
      title: t('activity.taskRecord.col.credits'),
      dataIndex: 'creditsGranted',
      search: false,
      align: 'end',
      render: (_, row) => countText(intl.locale, row.creditsGranted),
    },
    {
      title: t('activity.taskRecord.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('activity.taskRecord.note')}
      </Typography.Paragraph>
      <PagedListTable<TaskRecord, Filters>
        rowKey="id"
        columns={columns}
        request={({ page, pageSize, accountId, status }) => {
          const account = trimSpec(accountId ?? '');
          return listTaskRecords({
            page,
            pageSize,
            ...(account ? { accountId: account } : {}),
            ...(status ? { status } : {}),
          });
        }}
      />
    </Flex>
  );
}
