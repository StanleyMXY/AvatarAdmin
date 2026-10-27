import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { listFeedback, retryFeedback, type SupportFeedback } from '../../services/support';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { FeedbackDrawer } from './FeedbackDrawer';
import { categoryText, statusOptions } from './feedbackTexts';

/** 客服 · 反馈: what users sent from the app, whether it reached the support tool, and a retry for the ones that did not. */
export default function FeedbackPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canRetry = access.canAccess('SUPPORT:MANAGE');
  const ref = useRef<ActionType | undefined>(undefined);
  const [opened, setOpened] = useState<string | null>(null);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const retry = async (feedback: SupportFeedback) => {
    try {
      await retryFeedback(feedback.id);
      message.success(t('support.retried'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    // Either way the list is read again: after a refusal the state is not what the row showed.
    ref.current?.reload();
  };

  const columns: ProColumns<SupportFeedback>[] = [
    { title: t('support.col.id'), dataIndex: 'id', search: false },
    {
      title: t('support.col.category'),
      dataIndex: 'category',
      search: false,
      render: (_, row) => categoryText(intl, row.category),
    },
    { title: t('support.col.account'), dataIndex: 'accountId', search: false },
    {
      title: t('support.col.message'),
      dataIndex: 'message',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.message} lines={3} width={360} />,
    },
    {
      title: t('support.col.status'),
      dataIndex: 'forwardStatus',
      search: false,
      render: (_, row) => <StatusTag status={row.forwardStatus} options={statusOptions(intl)} />,
    },
    {
      title: t('support.col.forwardRef'),
      dataIndex: 'forwardRef',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.forwardRef} width={200} />,
    },
    {
      title: t('support.col.attempts'),
      dataIndex: 'attempts',
      search: false,
      render: (_, row) => row.attempts ?? DASH,
    },
    {
      title: t('support.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => formatInstant(row.createdAt, intl.locale),
    },
    {
      title: t('support.col.actions'),
      key: 'actions',
      search: false,
      render: (_, row) => {
        const actions: RowAction[] = [
          { key: 'detail', label: t('support.detail'), onClick: () => setOpened(row.id) },
        ];
        if (canRetry && row.forwardStatus === 'FAILED') {
          actions.push({
            key: 'retry',
            label: t('support.retry'),
            confirmText: t('support.retryConfirm'),
            onClick: () => retry(row),
          });
        }
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <>
      <PagedListTable<SupportFeedback>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listFeedback({ page, pageSize })}
      />
      <FeedbackDrawer id={opened} onClose={() => setOpened(null)} />
    </>
  );
}
