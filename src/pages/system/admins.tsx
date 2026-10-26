import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Tag } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type AdminUser,
  deleteAdmin,
  listAdmins,
  loadAllAdmins,
  resetAdminTotp,
  setAdminStatus,
} from '../../services/system';
import { useSession } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { AdminFormModal } from './AdminFormModal';
import { type RowProtection, rowProtection } from './adminRules';
import { ResetPasswordModal } from './ResetPasswordModal';
import { instantText, protectedFailureText } from './texts';
import { useRead } from './useRead';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; admin: AdminUser }
  | { kind: 'password'; admin: AdminUser };

const isRecord = (row: unknown): row is AdminUser => typeof row === 'object' && row !== null;

/**
 * 管理员 (`ADMIN:MANAGE`): the administrator accounts. Every control is for that one code, the code
 * of every endpoint of this page. The protections of the account are in the controls and again in the
 * request: nobody changes their own roles or super administrator flag, disables or deletes themselves
 * or the last enabled super administrator (the buttons are off), and only a super administrator sets
 * the flag. A refusal of the backend is shown as the text of its code, never its message.
 */
export default function AdminsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const { me } = useSession();
  const canManage = access.canAccess('ADMIN:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Every administrator, for "the last enabled super administrator" (the table shows one page only).
  const everyone = useRead(loadAllAdmins);
  const all = everyone.state.data?.filter(isRecord) ?? null;
  const refresh = () => {
    actionRef.current?.reload();
    everyone.reload();
  };
  const who = { id: me?.id, username: me?.username };
  const protectionOf = (row: AdminUser): RowProtection => rowProtection(row, who, all);

  const attempt = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      message.success(done);
    } catch (error) {
      message.error(protectedFailureText(intl, error));
    }
    refresh();
  };

  const actionsOf = (row: AdminUser): RowAction[] => {
    if (!canManage) return [];
    const protection = protectionOf(row);
    const name = plainText(row.username);
    const id = plainText(row.id);
    const enabled = row.status === 'ACTIVE';
    return [
      {
        key: 'edit',
        label: t('system.common.edit'),
        onClick: () => setDialog({ kind: 'edit', admin: row }),
      },
      enabled
        ? {
            key: 'disable',
            label: t('system.admins.disable'),
            confirmText: t('system.admins.disableAsk', { name }),
            disabled: protection.own || protection.lastSuper,
            onClick: () =>
              attempt(() => setAdminStatus(id, 'DISABLED'), t('system.admins.disabledDone')),
          }
        : {
            key: 'enable',
            label: t('system.admins.enable'),
            onClick: () =>
              attempt(() => setAdminStatus(id, 'ACTIVE'), t('system.admins.enabledDone')),
          },
      {
        key: 'password',
        label: t('system.admins.resetPassword'),
        onClick: () => setDialog({ kind: 'password', admin: row }),
      },
      {
        key: 'totp',
        label: t('system.admins.resetTotp'),
        confirmText: t('system.admins.resetTotpAsk', { name }),
        onClick: () => attempt(() => resetAdminTotp(id), t('system.admins.resetTotpDone')),
      },
      {
        key: 'delete',
        label: t('system.common.delete'),
        confirmText: t('system.admins.deleteAsk', { name }),
        disabled: protection.own || protection.lastSuper,
        onClick: () => attempt(() => deleteAdmin(id), t('system.common.deleted')),
      },
    ];
  };

  const statusOptions = {
    ACTIVE: { label: t('system.admins.status.ACTIVE'), color: 'green' },
    DISABLED: { label: t('system.admins.status.DISABLED') },
  };

  const columns: ProColumns<AdminUser>[] = [
    {
      title: t('system.admins.col.username'),
      dataIndex: 'username',
      search: false,
      render: (_, row) => (
        <Flex gap={6} align="center">
          <EllipsisPopoverText text={plainText(row.username)} lines={2} width={220} />
          {protectionOf(row).own ? (
            <Tag style={{ marginInlineEnd: 0 }}>{t('system.admins.you')}</Tag>
          ) : null}
        </Flex>
      ),
    },
    {
      title: t('system.admins.col.superAdmin'),
      dataIndex: 'superAdmin',
      search: false,
      render: (_, row) =>
        row.superAdmin === true ? <Tag color="gold">{t('system.admins.superYes')}</Tag> : DASH,
    },
    {
      title: t('system.admins.col.status'),
      dataIndex: 'status',
      search: false,
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      title: t('system.admins.col.mustChangePassword'),
      dataIndex: 'mustChangePassword',
      search: false,
      render: (_, row) =>
        row.mustChangePassword === true ? t('system.common.yes') : t('system.common.no'),
    },
    {
      title: t('system.admins.col.roles'),
      dataIndex: 'roles',
      search: false,
      render: (_, row) => {
        const roles = Array.isArray(row.roles) ? row.roles : [];
        if (roles.length === 0) return t('system.admins.noRoles');
        // A backend that went wrong can list a role twice: the count of the id so far keeps the keys apart.
        const seen = new Map<string, number>();
        return (
          <Flex wrap gap={4} style={{ maxWidth: 260 }}>
            {roles.map((role) => {
              const id = plainText(role?.id);
              const count = seen.get(id) ?? 0;
              seen.set(id, count + 1);
              return (
                <Tag
                  key={`${id}-${count}`}
                  style={{ marginInlineEnd: 0, overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                >
                  {plainText(role?.name)}
                </Tag>
              );
            })}
          </Flex>
        );
      },
    },
    {
      title: t('system.admins.col.lastLoginAt'),
      dataIndex: 'lastLoginAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.lastLoginAt),
    },
    {
      title: t('system.admins.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    ...(canManage
      ? [
          {
            title: t('system.admins.col.actions'),
            key: 'actions',
            search: false,
            fixed: 'right' as const,
            render: (_: unknown, row: AdminUser) => <RowActions actions={actionsOf(row)} />,
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('system.admins.note')} />
      <PagedListTable<AdminUser>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        request={({ page, pageSize }) => listAdmins({ page, pageSize })}
        toolbar={
          canManage
            ? [
                <Button key="new" type="primary" onClick={() => setDialog({ kind: 'create' })}>
                  {t('system.admins.new')}
                </Button>,
              ]
            : undefined
        }
      />
      {dialog?.kind === 'create' ? (
        <AdminFormModal
          admin={null}
          me={me}
          protection={{ own: false, lastSuper: false }}
          onDone={refresh}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'edit' ? (
        <AdminFormModal
          key={dialog.admin.id}
          admin={dialog.admin}
          me={me}
          protection={protectionOf(dialog.admin)}
          onDone={refresh}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'password' ? (
        <ResetPasswordModal
          key={dialog.admin.id}
          admin={dialog.admin}
          me={me}
          onDone={refresh}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Flex>
  );
}
