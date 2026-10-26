import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { type AdminRole, deleteRole, listRoles } from '../../services/system';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { RoleModal } from './RoleModal';
import { instantText } from './texts';

/**
 * 角色 (`ROLE:MANAGE`): the roles with the permissions they give. A role is made and changed in a
 * dialog with the tree of check boxes; deleting a role an administrator still has is refused by the
 * backend and shown as the text of ROLE_IN_USE. Every control is for ROLE:MANAGE, the code of every
 * endpoint of this page.
 */
export default function RolesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('ROLE:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<AdminRole | 'new' | null>(null);

  const refresh = () => actionRef.current?.reload();

  const remove = async (row: AdminRole) => {
    try {
      await deleteRole(plainText(row.id));
      message.success(t('system.common.deleted'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    refresh();
  };

  const actionsOf = (row: AdminRole): RowAction[] =>
    canManage
      ? [
          { key: 'edit', label: t('system.common.edit'), onClick: () => setEditing(row) },
          {
            key: 'delete',
            label: t('system.common.delete'),
            confirmText: t('system.roles.deleteAsk', { name: plainText(row.name) }),
            onClick: () => remove(row),
          },
        ]
      : [];

  const columns: ProColumns<AdminRole>[] = [
    {
      title: t('system.roles.col.name'),
      dataIndex: 'name',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={240} />,
    },
    {
      title: t('system.roles.col.remark'),
      dataIndex: 'remark',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.remark)} lines={2} width={280} />
      ),
    },
    {
      title: t('system.roles.col.permissions'),
      dataIndex: 'permissionCodes',
      search: false,
      align: 'end',
      render: (_, row) =>
        t('system.roles.count', {
          count: Array.isArray(row.permissionCodes) ? row.permissionCodes.length : 0,
        }),
    },
    {
      title: t('system.roles.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    ...(canManage
      ? [
          {
            title: t('system.roles.col.actions'),
            key: 'actions',
            search: false,
            fixed: 'right' as const,
            render: (_: unknown, row: AdminRole) => <RowActions actions={actionsOf(row)} />,
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('system.roles.note')} />
      <PagedListTable<AdminRole>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        request={({ page, pageSize }) => listRoles({ page, pageSize })}
        toolbar={
          canManage
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('system.roles.new')}
                </Button>,
              ]
            : undefined
        }
      />
      {editing !== null ? (
        <RoleModal
          key={editing === 'new' ? 'new' : editing.id}
          role={editing === 'new' ? null : editing}
          onDone={refresh}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Flex>
  );
}
