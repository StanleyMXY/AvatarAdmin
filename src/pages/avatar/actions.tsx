import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Tag } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import {
  type ActionItem,
  backfillAction,
  listActions,
  setActionEnabled,
} from '../../services/avatar';
import { describeFailure } from '../../session/describe';
import { ActionModal } from './ActionModal';
import { EnabledSwitch } from './EnabledSwitch';
import { pickText } from './localized';
import { Thumb } from './Thumb';
import { codeText, describeSurfaces } from './texts';

/** 动作目录 (`ACTION:MANAGE`): the gestures a character can make, each a clip generated in advance. */
export default function ActionsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('ACTION:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<ActionItem | null | 'new'>(null);
  const reload = () => ref.current?.reload();

  const backfill = async (row: ActionItem) => {
    try {
      const { scheduled } = await backfillAction(row.id);
      if (scheduled > 0) message.success(t('avatar.actions.scheduled', { count: scheduled }));
      else message.info(t('avatar.actions.nothingToDo'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    // Either way the row is read again: after a refusal it may no longer be what the row showed.
    reload();
  };

  const columns: ProColumns<ActionItem>[] = [
    {
      title: t('avatar.col.key'),
      dataIndex: 'key',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.key} lines={1} width={160} />,
    },
    {
      title: t('avatar.col.name'),
      dataIndex: 'names',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={pickText(row.names, intl.locale)} lines={2} width={200} />
      ),
    },
    {
      title: t('avatar.col.icon'),
      dataIndex: 'iconUrl',
      search: false,
      render: (_, row) => <Thumb url={row.iconUrl} alt={row.key} />,
    },
    {
      title: t('avatar.col.styles'),
      dataIndex: 'compatibleStyles',
      search: false,
      render: (_, row) => (
        <Flex gap={4} wrap>
          {row.compatibleStyles.map((style) => (
            <Tag key={style}>{codeText(intl, 'avatar.style', style)}</Tag>
          ))}
        </Flex>
      ),
    },
    {
      title: t('avatar.col.surfaces'),
      dataIndex: 'surfaces',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={describeSurfaces(intl, row.surfaces)} lines={2} width={180} />
      ),
    },
    {
      title: t('avatar.col.triggerableBy'),
      dataIndex: 'triggerableBy',
      search: false,
      render: (_, row) => codeText(intl, 'avatar.triggerableBy', row.triggerableBy),
    },
    {
      title: t('avatar.col.enabled'),
      dataIndex: 'enabled',
      search: false,
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled}
          disabled={!canWrite}
          label={t('avatar.enabledOf', { key: row.key })}
          onToggle={(next) => setActionEnabled(row.id, next)}
          onDone={reload}
        />
      ),
    },
    { title: t('avatar.col.sortOrder'), dataIndex: 'sortOrder', search: false, align: 'right' },
    {
      title: t('avatar.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => {
        const actions: RowAction[] = [];
        if (canWrite) {
          actions.push({ key: 'edit', label: t('avatar.edit'), onClick: () => setEditing(row) });
          actions.push({
            key: 'backfill',
            label: t('avatar.actions.backfill'),
            confirmText: t('avatar.actions.backfillConfirm'),
            // A disabled action is refused by the backend (409); the button says so up front.
            disabled: !row.enabled,
            onClick: () => backfill(row),
          });
        }
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('avatar.actions.note')} />
      <PagedListTable<ActionItem>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listActions({ page, pageSize })}
        toolbar={
          canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('avatar.actions.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <ActionModal
        open={editing !== null}
        action={editing === 'new' || editing === null ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}
