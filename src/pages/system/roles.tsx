import { useAccess, useIntl } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import { Alert, App, Button, Flex, Typography } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type RowAction, RowActions } from '../../components/RowActions';
import { type AdminRole, deleteRole, listRoles } from '../../services/system';
import { describeFailure } from '../../session/describe';
import { useSession } from '../../session/useSession';
import { instantText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { PagedTable } from './PagedTable';
import { RoleModal } from './RoleModal';
import { withScopeHint } from './texts';

/**
 * 角色 (`ROLE:MANAGE`): the roles with the permissions they give. A role is made and changed in a
 * dialog with the tree of check boxes; deleting a role an administrator still has is refused by the
 * backend and shown as the text of ROLE_IN_USE. Every control is for ROLE:MANAGE, the code of every
 * endpoint of this page. An administrator who is not a super administrator cannot change a role they
 * are given (`GET /me` lists their role ids): Edit is off on those rows with the reason written in the
 * row, and the backend still has the last word (403 with `data.reason` OWN_ROLE).
 */
export default function RolesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('ROLE:MANAGE');
  const { me } = useSession();
  // A super administrator is not bound by the rule; `roleIds` is missing in an older answer of `/me`.
  const givenRoles = new Set<string>(me?.superAdmin === true ? [] : (me?.roleIds ?? []));
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const reloadRef = useRef<(() => void) | null>(null);
  const [editing, setEditing] = useState<AdminRole | 'new' | null>(null);

  const load = useCallback((paging: { page: number; pageSize: number }) => listRoles(paging), []);
  const refresh = () => reloadRef.current?.();

  const remove = async (row: AdminRole) => {
    try {
      await deleteRole(plainText(row.id));
      message.success(t('system.common.deleted'));
    } catch (error) {
      message.error(withScopeHint(intl, error, describeFailure(intl, error).text));
    }
    refresh();
  };

  const isGiven = (row: AdminRole): boolean => givenRoles.has(plainText(row.id));

  const actionsOf = (row: AdminRole): RowAction[] =>
    canManage
      ? [
          {
            key: 'edit',
            label: t('system.common.edit'),
            disabled: isGiven(row),
            onClick: () => setEditing(row),
          },
          {
            key: 'delete',
            label: t('system.common.delete'),
            confirmText: t('system.roles.deleteAsk', { name: plainText(row.name) }),
            onClick: () => remove(row),
          },
        ]
      : [];

  const columns: TableColumnsType<AdminRole> = [
    {
      title: t('system.roles.col.name'),
      dataIndex: 'name',
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={240} />,
    },
    {
      title: t('system.roles.col.remark'),
      dataIndex: 'remark',
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.remark)} lines={2} width={280} />
      ),
    },
    {
      title: t('system.roles.col.permissions'),
      dataIndex: 'permissionCodes',
      align: 'end',
      render: (_, row) =>
        t('system.roles.count', {
          count: Array.isArray(row.permissionCodes) ? row.permissionCodes.length : 0,
        }),
    },
    {
      title: t('system.roles.col.createdAt'),
      dataIndex: 'createdAt',
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    ...(canManage
      ? [
          {
            ...ACTIONS_COLUMN,
            title: t('system.roles.col.actions'),
            key: 'actions',
            render: (_: unknown, row: AdminRole) => (
              <Flex vertical gap={4} style={{ maxWidth: 260 }}>
                <RowActions actions={actionsOf(row)} />
                {isGiven(row) ? (
                  // Small text in the row, where the keyboard and the touch screen see it as well as the pointer.
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('system.roles.ownRoleReason')}
                  </Typography.Text>
                ) : null}
              </Flex>
            ),
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('system.roles.note')} />
      <PagedTable<AdminRole>
        rowKey="id"
        columns={columns}
        reloadRef={reloadRef}
        load={load}
        toolbar={
          canManage ? (
            <Button type="primary" onClick={() => setEditing('new')}>
              {t('system.roles.new')}
            </Button>
          ) : undefined
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
