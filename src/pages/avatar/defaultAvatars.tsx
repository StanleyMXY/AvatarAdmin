import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Tag, Typography } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  activateDefaultAvatar,
  type DefaultAvatar,
  deleteDefaultAvatar,
  generateDefaultAvatar,
  listDefaultAvatars,
} from '../../services/avatar';
import { codeText } from '../../utils/displayText';
import { defaultAvatarFailure } from './defaultAvatarFailure';
import { NewDefaultAvatarModal } from './NewDefaultAvatarModal';
import { RenameDefaultAvatarModal } from './RenameDefaultAvatarModal';
import { Thumb } from './Thumb';
import { useGenerationPolling } from './useGenerationPolling';

/**
 * 系统默认数字人 (`DEFAULT_AVATAR:MANAGE`): the avatar guests and accounts without one talk to. One
 * source picture becomes a draft; it is generated, then set active (only one is active at a time).
 * The state decides which button a row has. There is no FAILED state: a failed generation is a
 * draft again with the reason beside it.
 */
export default function DefaultAvatarsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('DEFAULT_AVATAR:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<DefaultAvatar | null>(null);
  const [generating, setGenerating] = useState(false);
  const [asked, setAsked] = useState(0);
  const poll = useCallback(() => ref.current?.reload(), []);
  const { gaveUp } = useGenerationPolling(generating, poll, asked);
  /** A read the person asked for (a button, a write): it also starts the 5 minutes of reading by itself again. */
  const reload = () => {
    setAsked((n) => n + 1);
    ref.current?.reload();
  };

  /** Runs one action on a row. Whatever the answer, the list is read again: after a refusal the row has another state. */
  const act = async (done: string, call: () => Promise<unknown>) => {
    try {
      await call();
      message.success(t(done));
    } catch (error) {
      message.error(defaultAvatarFailure(intl, error));
    }
    reload();
  };

  const statusOptions = {
    DRAFT: { label: codeText(intl, 'avatar.defaults.status', 'DRAFT') },
    GENERATING: {
      label: codeText(intl, 'avatar.defaults.status', 'GENERATING'),
      color: 'processing',
    },
    READY: { label: codeText(intl, 'avatar.defaults.status', 'READY'), color: 'green' },
  };

  const actionsOf = (row: DefaultAvatar): RowAction[] => {
    if (!canWrite || row.status === 'GENERATING') return [];
    const actions: RowAction[] = [];
    if (row.status === 'DRAFT') {
      actions.push({
        key: 'generate',
        label: t('avatar.defaults.generate'),
        onClick: () => act('avatar.defaults.generating', () => generateDefaultAvatar(row.id)),
      });
    }
    if (row.status === 'READY' && !row.isActive) {
      actions.push({
        key: 'activate',
        label: t('avatar.defaults.activate'),
        confirmText: t('avatar.defaults.activateConfirm'),
        onClick: () => act('avatar.defaults.activated', () => activateDefaultAvatar(row.id)),
      });
    }
    actions.push({
      key: 'rename',
      label: t('avatar.defaults.rename'),
      onClick: () => setRenaming(row),
    });
    if (!row.isActive) {
      actions.push({
        key: 'delete',
        label: t('avatar.defaults.delete'),
        confirmText: t('avatar.defaults.deleteConfirm'),
        onClick: () => act('avatar.defaults.deleted', () => deleteDefaultAvatar(row.id)),
      });
    }
    return actions;
  };

  const columns: ProColumns<DefaultAvatar>[] = [
    {
      title: t('avatar.defaults.name'),
      dataIndex: 'name',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.name} lines={2} width={200} />,
    },
    {
      title: t('avatar.defaults.style'),
      dataIndex: 'style',
      search: false,
      render: (_, row) => codeText(intl, 'avatar.style', row.style),
    },
    {
      title: t('avatar.defaults.source'),
      dataIndex: 'sourceImageUrl',
      search: false,
      render: (_, row) => <Thumb url={row.sourceImageUrl} alt={row.name} />,
    },
    {
      title: t('avatar.defaults.preview'),
      dataIndex: 'previewUrl',
      search: false,
      render: (_, row) => <Thumb url={row.previewUrl} alt={row.name} />,
    },
    {
      title: t('avatar.defaults.statusColumn'),
      dataIndex: 'status',
      search: false,
      render: (_, row) => (
        <Flex vertical gap={4} align="start">
          <StatusTag status={row.status} options={statusOptions} />
          {row.status === 'DRAFT' && row.failureReason ? (
            <Typography.Text type="danger" data-testid="failure-reason">
              {t('avatar.defaults.failedWith', {
                reason: codeText(intl, 'avatar.failure', row.failureReason),
              })}
            </Typography.Text>
          ) : null}
        </Flex>
      ),
    },
    {
      title: t('avatar.defaults.isActive'),
      dataIndex: 'isActive',
      search: false,
      render: (_, row) =>
        row.isActive ? <Tag color="green">{t('avatar.defaults.active')}</Tag> : t('avatar.no'),
    },
    {
      title: t('avatar.col.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      render: (_, row) => <RowActions actions={actionsOf(row)} />,
    },
  ];

  return (
    <>
      <Typography.Paragraph type="secondary">{t('avatar.defaults.note')}</Typography.Paragraph>
      {gaveUp ? (
        <Typography.Paragraph type="warning">
          {t('avatar.defaults.pollStopped')}
        </Typography.Paragraph>
      ) : null}
      <PagedListTable<DefaultAvatar>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        // The list is not paged by the backend (a short list, newest first): the page is cut here.
        request={async ({ page, pageSize }) => {
          const { items } = await listDefaultAvatars();
          setGenerating(items.some((d) => d.status === 'GENERATING'));
          return {
            items: items.slice((page - 1) * pageSize, page * pageSize),
            total: items.length,
          };
        }}
        toolbar={[
          <Button key="refresh" onClick={reload}>
            {t('avatar.defaults.refresh')}
          </Button>,
          ...(canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setCreating(true)}>
                  {t('avatar.defaults.new')}
                </Button>,
              ]
            : []),
        ]}
      />
      <NewDefaultAvatarModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />
      <RenameDefaultAvatarModal
        avatar={renaming}
        onClose={() => setRenaming(null)}
        onSaved={reload}
      />
    </>
  );
}
