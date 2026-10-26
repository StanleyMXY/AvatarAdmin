import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { cancelTask, listTasks, type PushTask } from '../../services/push';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { supportedLocalesOf } from './coverage';
import { TaskModal } from './TaskModal';
import { codeText, countText, instantText } from './texts';

/** 手动推送任务 (`PUSH:SEND`): one-off pushes to an audience, now or at a time. Only a waiting task can be cancelled. */
export default function TasksPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canSend = access.canAccess('PUSH:SEND');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const locales = supportedLocalesOf(useAdminMeta() as { supportedLocales?: unknown });
  const ref = useRef<ActionType | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const reload = () => ref.current?.reload();

  const statusOptions = {
    PENDING: { label: t('push.status.PENDING'), color: 'blue' },
    RUNNING: { label: t('push.status.RUNNING'), color: 'processing' },
    DONE: { label: t('push.status.DONE'), color: 'success' },
    CANCELLED: { label: t('push.status.CANCELLED') },
  };

  const columns: ProColumns<PushTask>[] = [
    {
      title: t('push.tasks.col.title'),
      dataIndex: 'title',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.title)} lines={2} width={220} />,
    },
    {
      title: t('push.tasks.col.audience'),
      dataIndex: 'audience',
      search: false,
      render: (_, row) => codeText(intl, 'push.audience', row.audience) || DASH,
    },
    {
      title: t('push.tasks.col.status'),
      dataIndex: 'status',
      search: false,
      render: (_, row) => (
        <Flex gap={4} wrap>
          <StatusTag
            status={typeof row.status === 'string' ? row.status : null}
            options={statusOptions}
          />
          {row.note === 'MISSED' ? <Tag color="warning">{t('push.tasks.missed')}</Tag> : null}
        </Flex>
      ),
    },
    {
      title: t('push.tasks.col.sent'),
      dataIndex: 'sentCount',
      search: false,
      align: 'right',
      render: (_, row) => countText(intl.locale, row.sentCount),
    },
    {
      title: t('push.tasks.col.failed'),
      dataIndex: 'failedCount',
      search: false,
      align: 'right',
      render: (_, row) => countText(intl.locale, row.failedCount),
    },
    {
      title: t('push.tasks.col.createdBy'),
      dataIndex: 'createdByUsername',
      search: false,
      // The name is null when the administrator has been deleted; the id is what is left then.
      render: (_, row) => (
        <EllipsisPopoverText
          text={plainText(row.createdByUsername) || plainText(row.createdBy)}
          lines={1}
          width={140}
        />
      ),
    },
    {
      title: t('push.tasks.col.scheduledAt'),
      dataIndex: 'scheduledAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.scheduledAt),
    },
    {
      title: t('push.tasks.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) =>
        canSend && row.status === 'PENDING' ? (
          <RowActions
            actions={[
              {
                key: 'cancel',
                label: t('push.tasks.cancel'),
                confirmText: t('push.tasks.cancelConfirm'),
                onClick: async () => {
                  try {
                    await cancelTask(row.id);
                    message.success(t('push.tasks.cancelled'));
                  } catch (error) {
                    message.error(describeFailure(intl, error).text);
                  }
                  reload();
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('push.tasks.note')}
      </Typography.Paragraph>
      <PagedListTable<PushTask>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listTasks({ page, pageSize })}
        toolbar={
          canSend
            ? [
                <Button key="new" type="primary" onClick={() => setCreating(true)}>
                  {t('push.tasks.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <TaskModal
        open={creating}
        locales={locales}
        onClose={() => setCreating(false)}
        onSaved={reload}
      />
    </Flex>
  );
}
