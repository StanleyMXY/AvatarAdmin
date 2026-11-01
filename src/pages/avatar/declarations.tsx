import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Tag } from 'antd';
import { useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { activateDeclaration, type Declaration, listDeclarations } from '../../services/avatar';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { DeclarationModal } from './DeclarationModal';

/** 上传声明 (`DECLARATION:MANAGE`): the versions of the text a user agrees to when uploading a photo, and which one is in force. */
export default function DeclarationsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const meta = useAdminMeta();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('DECLARATION:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const reload = () => ref.current?.reload();

  const activate = async (row: Declaration) => {
    try {
      await activateDeclaration(row.version);
      message.success(t('avatar.declarations.activated', { version: row.version }));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    reload();
  };

  const columns: ProColumns<Declaration>[] = [
    {
      title: t('avatar.declarations.version'),
      dataIndex: 'version',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.version} lines={1} width={200} />,
    },
    {
      title: t('avatar.declarations.languages'),
      dataIndex: 'texts',
      search: false,
      render: (_, row) =>
        Object.keys(row.texts ?? {})
          .sort()
          .join(', ') || DASH,
    },
    {
      title: t('avatar.declarations.activeFrom'),
      dataIndex: 'activeFrom',
      search: false,
      render: (_, row) => (row.activeFrom ? formatInstant(row.activeFrom, intl.locale) : DASH),
    },
    {
      title: t('avatar.declarations.isActive'),
      dataIndex: 'isActive',
      search: false,
      render: (_, row) =>
        row.isActive ? (
          <Tag color="green">{t('avatar.declarations.active')}</Tag>
        ) : (
          t('avatar.declarations.inactive')
        ),
    },
    {
      title: t('avatar.col.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      render: (_, row) => {
        const actions: RowAction[] = [];
        if (canWrite && !row.isActive) {
          actions.push({
            key: 'activate',
            label: t('avatar.declarations.activate'),
            confirmText: t('avatar.declarations.activateConfirm'),
            onClick: () => activate(row),
          });
        }
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <>
      {meta.declarationRequired === false ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('avatar.declarations.notRequired')}
        />
      ) : null}
      <PagedListTable<Declaration>
        rowKey="version"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listDeclarations({ page, pageSize })}
        toolbar={
          canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setCreating(true)}>
                  {t('avatar.declarations.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <DeclarationModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />
    </>
  );
}
