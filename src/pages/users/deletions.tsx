import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { App, Flex, Tag, Typography } from 'antd';
import { useRef } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type AccountDeletionRow,
  DELETION_STATUSES,
  listAccountDeletions,
  retryAccountDeletion,
} from '../../services/users';
import { useAdminMeta } from '../../session/useSession';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';
import { STATUS_COLORS } from './statusColors';
import { actionFailure, countText, labelOf } from './text';
import { UserLink } from './UserLink';

type Filters = { status?: string };

/** The threshold of `GET /meta` as a number of failures that is worth an alert, or null when it is not known. */
function thresholdOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : null;
}

/**
 * 账号删除任务 (`USER:DELETION`): every deletion task with its state, the reason the user chose, the
 * planned time, the retries and the last error. A failed task has "retry". A row whose retries reach
 * `deletion.alert_after_failures` (read from `GET /meta`, never written into the page) is
 * highlighted; without that number nothing is highlighted.
 */
export default function DeletionsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const meta = useAdminMeta();
  const threshold = thresholdOf(meta.deletionAlertAfterFailures);
  const actionRef = useRef<ActionType | undefined>(undefined);

  const alerting = (row: AccountDeletionRow) =>
    threshold !== null && typeof row.attempts === 'number' && row.attempts >= threshold;
  // Every cell of an alerting row is tinted, so the whole row stands out.
  const tint = (row: AccountDeletionRow) =>
    alerting(row) ? { style: { background: 'var(--ant-color-error-bg, #fff2f0)' } } : {};
  const when = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? DASH : formatInstant(text, intl.locale);
  };

  const statusEnum = Object.fromEntries(
    DELETION_STATUSES.map((status) => [
      status,
      { text: labelOf(intl, 'users.deletionStatus', status) },
    ]),
  );
  const statusOptions = Object.fromEntries(
    DELETION_STATUSES.map((status) => [
      status,
      { label: labelOf(intl, 'users.deletionStatus', status), color: STATUS_COLORS[status] },
    ]),
  );

  const retry = (row: AccountDeletionRow) => async () => {
    try {
      await retryAccountDeletion(row.id);
      message.success(t('users.deletions.retried'));
    } catch (error) {
      message.error(actionFailure(intl, error, 'task'));
    } finally {
      actionRef.current?.reload();
    }
  };

  const columns: ProColumns<AccountDeletionRow>[] = [
    {
      title: t('users.deletions.taskId'),
      dataIndex: 'id',
      search: false,
      onCell: tint,
      render: (_, row) => <Cell value={row.id} lines={2} />,
    },
    {
      title: t('users.common.accountId'),
      dataIndex: 'accountId',
      search: false,
      onCell: tint,
      render: (_, row) => <UserLink accountId={row.accountId} />,
    },
    {
      title: t('users.common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: statusEnum,
      onCell: tint,
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      title: t('users.deletions.reason'),
      dataIndex: 'reason',
      search: false,
      onCell: tint,
      render: (_, row) => labelOf(intl, 'users.deletionReason', row.reason),
    },
    {
      title: t('users.deletions.executeAfter'),
      dataIndex: 'executeAfter',
      search: false,
      onCell: tint,
      render: (_, row) => when(row.executeAfter),
    },
    {
      title: t('users.deletions.attempts'),
      dataIndex: 'attempts',
      search: false,
      align: 'right',
      onCell: tint,
      render: (_, row) => (
        <span data-testid="attempts" data-alert={String(alerting(row))}>
          <Flex gap={6} justify="flex-end" align="center">
            {alerting(row) ? <Tag color="red">{t('users.deletions.alerting')}</Tag> : null}
            <span>{countText(row.attempts, intl.locale)}</span>
          </Flex>
        </span>
      ),
    },
    {
      title: t('users.deletions.lastError'),
      dataIndex: 'lastError',
      search: false,
      onCell: tint,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.lastError)} lines={2} width={260} />
      ),
    },
    {
      title: t('users.deletions.requestedBy'),
      dataIndex: 'requestedBy',
      search: false,
      onCell: tint,
      render: (_, row) =>
        row.requestedBy === null || row.requestedBy === undefined ? (
          DASH
        ) : (
          <Cell value={row.requestedByUsername ?? plainText(row.requestedBy).slice(0, 8)} />
        ),
    },
    {
      title: t('users.common.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      onCell: tint,
      render: (_, row) => when(row.createdAt),
    },
    {
      title: t('users.deletions.completedAt'),
      dataIndex: 'completedAt',
      search: false,
      onCell: tint,
      render: (_, row) => when(row.completedAt),
    },
    {
      title: t('users.common.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      onCell: tint,
      render: (_, row) => (
        <RowActions
          actions={
            row.status === 'FAILED'
              ? [
                  {
                    key: 'retry',
                    label: t('users.deletions.retry'),
                    confirmText: t('users.deletions.retryConfirm'),
                    onClick: retry(row),
                  },
                ]
              : []
          }
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      {threshold !== null ? (
        <Typography.Text type="secondary">
          {t('users.deletions.threshold', { n: threshold })}
        </Typography.Text>
      ) : null}
      <PagedListTable<AccountDeletionRow, Filters>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        request={({ page, pageSize, status }) =>
          listAccountDeletions({ page, pageSize, ...(status ? { status } : {}) })
        }
      />
    </Flex>
  );
}
