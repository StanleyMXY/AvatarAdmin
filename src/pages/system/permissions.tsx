import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type RowAction, RowActions } from '../../components/RowActions';
import { useLatestRead } from '../../hooks/useLatestRead';
import { deletePermission, listPermissions, type PermissionNode } from '../../services/system';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { PermissionNodeModal } from './PermissionNodeModal';
import { buildIndex, isBuiltinNode, nodeName, type TreeIndex } from './permissionTree';

type Row = { node: PermissionNode; children?: Row[] };

function rowsOf(index: TreeIndex, codes: string[]): Row[] {
  return codes.map((code) => {
    const children = index.childrenOf.get(code) ?? [];
    const row: Row = { node: index.byCode.get(code) as PermissionNode };
    if (children.length > 0) row.children = rowsOf(index, children);
    return row;
  });
}

/**
 * 权限树: the permission nodes as a tree. Reading needs ROLE:MANAGE or PERMISSION:MANAGE; every
 * write needs PERMISSION:MANAGE and its buttons are drawn only for it. A built-in node can be renamed
 * and reordered, nothing else, and has no delete; a custom node can also change its parent (never to
 * itself or a descendant) and be deleted. A delete the backend refuses because the node has children
 * is shown as the text of PERMISSION_HAS_CHILDREN.
 */
export default function PermissionsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('PERMISSION:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const tree = useLatestRead(listPermissions, { keepWhileReading: true });
  const nodes: PermissionNode[] = useMemo(
    () => (tree.data ?? []).filter((n) => typeof n === 'object' && n !== null),
    [tree.data],
  );
  const index = useMemo(() => buildIndex(nodes), [nodes]);
  const data = useMemo(() => rowsOf(index, index.roots), [index]);
  const [dialog, setDialog] = useState<PermissionNode | 'new' | null>(null);
  // Null: every node with children is open (the first look at the tree).
  const [openKeys, setOpenKeys] = useState<readonly string[] | null>(null);
  const allKeys = useMemo(
    () => index.codes.filter((code) => (index.childrenOf.get(code) ?? []).length > 0),
    [index],
  );

  const remove = async (node: PermissionNode) => {
    try {
      await deletePermission(node.code);
      message.success(t('system.common.deleted'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    tree.reload();
  };

  const actionsOf = (node: PermissionNode): RowAction[] => {
    if (!canWrite) return [];
    const actions: RowAction[] = [
      { key: 'edit', label: t('system.common.edit'), onClick: () => setDialog(node) },
    ];
    // A built-in node cannot be deleted: the checks of the application rely on it.
    if (!isBuiltinNode(node)) {
      actions.push({
        key: 'delete',
        label: t('system.common.delete'),
        confirmText: t('system.permissions.deleteAsk', { code: node.code }),
        onClick: () => remove(node),
      });
    }
    return actions;
  };

  const columns: ColumnsType<Row> = [
    {
      key: 'name',
      title: t('system.permissions.col.name'),
      render: (_, row) => (
        <EllipsisPopoverText text={nodeName(row.node, intl.locale)} lines={2} width={300} />
      ),
    },
    {
      key: 'code',
      title: t('system.permissions.col.code'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.node.code)} lines={2} width={220} dir="ltr" />
      ),
    },
    {
      key: 'type',
      title: t('system.permissions.col.type'),
      render: (_, row) => {
        const type = plainText(row.node.type);
        return intl.messages[`system.permissions.type.${type}`]
          ? t(`system.permissions.type.${type}`)
          : type || DASH;
      },
    },
    {
      key: 'sortOrder',
      title: t('system.permissions.col.sortOrder'),
      align: 'end',
      render: (_, row) =>
        typeof row.node.sortOrder === 'number' ? String(row.node.sortOrder) : DASH,
    },
    {
      key: 'builtin',
      title: t('system.permissions.col.builtin'),
      render: (_, row) =>
        isBuiltinNode(row.node) ? (
          <Tag>{t('system.permissions.builtin')}</Tag>
        ) : (
          <Tag color="blue">{t('system.permissions.custom')}</Tag>
        ),
    },
    ...(canWrite
      ? [
          {
            ...ACTIONS_COLUMN,
            key: 'actions',
            title: t('system.permissions.col.actions'),
            render: (_: unknown, row: Row) => <RowActions actions={actionsOf(row.node)} />,
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('system.permissions.note')} />
      {tree.failure !== null ? (
        <Alert
          type="error"
          showIcon
          title={t('system.common.readFailed', {
            message: describeFailure(intl, tree.error).text,
          })}
          action={
            <Button size="small" onClick={tree.reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {canWrite ? (
        <Flex justify="flex-end">
          <Button type="primary" onClick={() => setDialog('new')}>
            {t('system.permissions.new')}
          </Button>
        </Flex>
      ) : null}
      <Table<Row>
        rowKey={(row) => row.node.code}
        columns={columns}
        dataSource={data}
        loading={tree.loading && tree.data === null}
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowKeys: (openKeys ?? allKeys) as string[],
          onExpandedRowsChange: (keys) => setOpenKeys(keys as string[]),
        }}
        locale={{ emptyText: t('system.permissions.empty') }}
      />
      {dialog !== null && tree.data !== null ? (
        <PermissionNodeModal
          key={dialog === 'new' ? 'new' : dialog.code}
          node={dialog === 'new' ? null : dialog}
          nodes={nodes}
          onDone={tree.reload}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Flex>
  );
}
