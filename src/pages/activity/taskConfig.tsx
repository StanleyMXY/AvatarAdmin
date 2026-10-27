import { QuestionCircleOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  deleteTaskConfig,
  listTaskConfigs,
  setTaskConfigStatus,
  TASK_STATUSES,
  TASK_TYPES,
  type TaskConfig,
  type TaskStatus,
  type TaskType,
} from '../../services/activity';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { TaskFormModal } from './TaskFormModal';
import { codeText, countText, instantText } from './texts';

type Filters = { taskName?: string; taskType?: TaskType; status?: TaskStatus };

const STATUS_COLOR: Record<string, string> = { ENABLED: 'success', DISABLED: 'default' };

/**
 * 任务配置 (`TASK:VIEW`, writing needs `TASK:MANAGE`): the daily tasks. A task that has records
 * cannot be deleted (TASK_HAS_RECORDS: it is stopped instead) and keeps its type and target.
 */
export default function TaskConfigPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('TASK:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<'new' | TaskConfig | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Each opening of the form is a new form: the values of the one before are not carried over.
  const [formSession, setFormSession] = useState(0);
  const openForm = (target: 'new' | TaskConfig) => {
    setFormSession((n) => n + 1);
    setEditing(target);
    setFormOpen(true);
  };
  const reload = () => ref.current?.reload();

  const switchTo = (row: TaskConfig, status: TaskStatus) => async () => {
    try {
      await setTaskConfigStatus(row.id, status);
      message.success(t(status === 'ENABLED' ? 'activity.task.enabled' : 'activity.task.disabled'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    reload();
  };

  const actionsOf = (row: TaskConfig): RowAction[] => [
    { key: 'edit', label: t('activity.task.edit'), onClick: () => openForm(row) },
    row.status === 'ENABLED'
      ? {
          key: 'disable',
          label: t('activity.task.disable'),
          confirmText: t('activity.task.disableConfirm'),
          onClick: switchTo(row, 'DISABLED'),
        }
      : {
          key: 'enable',
          label: t('activity.task.enable'),
          confirmText: t('activity.task.enableConfirm'),
          onClick: switchTo(row, 'ENABLED'),
        },
    {
      key: 'delete',
      label: t('activity.task.delete'),
      confirmText: t('activity.task.deleteConfirm'),
      onClick: async () => {
        try {
          await deleteTaskConfig(row.id);
          message.success(t('activity.task.deleted'));
        } catch (error) {
          // TASK_HAS_RECORDS: the words of the code already say to stop the task instead.
          message.error(describeFailure(intl, error).text);
        }
        reload();
      },
    },
  ];

  const target = (row: TaskConfig) =>
    row.taskType === 'call_seconds' && typeof row.targetValue === 'number'
      ? t('activity.task.targetSeconds', { value: countText(intl.locale, row.targetValue) })
      : countText(intl.locale, row.targetValue);

  const columns: ProColumns<TaskConfig>[] = [
    {
      title: t('activity.task.col.name'),
      dataIndex: 'taskName',
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.taskName)} lines={2} width={180} />
      ),
    },
    {
      title: t('activity.task.col.type'),
      dataIndex: 'taskType',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        TASK_TYPES.map((type) => [type, { text: t(`activity.task.type.${type}`) }]),
      ),
      render: (_, row) => codeText(intl, 'activity.task.type', row.taskType) || DASH,
    },
    {
      title: t('activity.task.col.target'),
      dataIndex: 'targetValue',
      search: false,
      align: 'end',
      render: (_, row) => target(row),
    },
    {
      title: t('activity.task.col.reward'),
      dataIndex: 'rewardCredits',
      search: false,
      align: 'end',
      render: (_, row) => countText(intl.locale, row.rewardCredits),
    },
    {
      title: t('activity.task.col.description'),
      dataIndex: 'description',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.description)} lines={2} width={200} />
      ),
    },
    {
      title: (
        <span>
          {t('activity.task.col.claim')}
          <Tooltip title={t('activity.task.claim.tip')}>
            <QuestionCircleOutlined
              data-testid="tip-claim"
              aria-hidden={false}
              style={{ marginInlineStart: 4 }}
            />
          </Tooltip>
        </span>
      ),
      dataIndex: 'claimTimeoutSeconds',
      search: false,
      align: 'end',
      render: (_, row) => countText(intl.locale, row.claimTimeoutSeconds),
    },
    {
      title: t('activity.task.col.sort'),
      dataIndex: 'sortOrder',
      search: false,
      align: 'end',
      render: (_, row) => countText(intl.locale, row.sortOrder),
    },
    {
      title: t('activity.task.col.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        TASK_STATUSES.map((status) => [status, { text: t(`activity.task.status.${status}`) }]),
      ),
      render: (_, row) => (
        <StatusTag
          status={plainText(row.status)}
          options={Object.fromEntries(
            TASK_STATUSES.map((status) => [
              status,
              { label: t(`activity.task.status.${status}`), color: STATUS_COLOR[status] },
            ]),
          )}
        />
      ),
    },
    {
      title: t('activity.task.col.time'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => (
        <Flex vertical gap={0}>
          <Typography.Text type="secondary">
            {t('activity.task.time.created', { time: instantText(intl.locale, row.createdAt) })}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t('activity.task.time.updated', { time: instantText(intl.locale, row.updatedAt) })}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: t('activity.task.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => (canManage ? <RowActions actions={actionsOf(row)} /> : null),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PagedListTable<TaskConfig, Filters>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize, taskName, taskType, status }) =>
          listTaskConfigs({
            page,
            pageSize,
            ...(taskName && trimSpec(taskName) ? { taskName: trimSpec(taskName) } : {}),
            ...(taskType ? { taskType } : {}),
            ...(status ? { status } : {}),
          })
        }
        toolbar={
          canManage
            ? [
                <Button key="new" type="primary" onClick={() => openForm('new')}>
                  {t('activity.task.new')}
                </Button>,
              ]
            : undefined
        }
      />
      {canManage ? (
        <TaskFormModal
          key={formSession}
          target={editing}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={reload}
        />
      ) : null}
    </Flex>
  );
}
