import { Link, useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import type { ClientConfigItem } from '../../services/clientConfig';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { FailureBar } from '../notifications/FailureBar';
import { ClientConfigEditor } from './ClientConfigEditor';
import { keyText, readOnlyNote, typeText } from './texts';
import { useItems } from './useItems';

const isItem = (row: unknown): row is ClientConfigItem => typeof row === 'object' && row !== null;

/**
 * 客户端配置: every registered key of the configuration the client reads (CLIENTCONFIG:VIEW), with
 * what it is, its type, whether it is per language, whether it has a value and where the client
 * uses it. A row opens the editor of the key; changing needs CLIENTCONFIG:MANAGE, and the keys
 * the system decides (the interface marks them read only) can only be looked at.
 */
export default function ClientConfigPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { items, failure, loading, reload } = useItems();
  const [open, setOpen] = useState<ClientConfigItem | null>(null);

  const canManage = access.canAccess('CLIENTCONFIG:MANAGE');
  const canOpenSystemConfig = access.canAccess('CONFIG:MANAGE');
  const editableItem = (row: ClientConfigItem) =>
    canManage && row.readOnly !== true && plainText(row.type) !== 'STRING_LIST';
  const wrap = { overflowWrap: 'anywhere' as const };

  const columns: ColumnsType<ClientConfigItem> = [
    {
      key: 'key',
      title: t('clientConfig.col.key'),
      render: (_, row) => (
        <span style={wrap}>
          <Typography.Text strong style={wrap}>
            {plainText(row.key)}
          </Typography.Text>
          {row.readOnly === true ? (
            <Tag style={{ marginInlineStart: 8 }}>{t('clientConfig.readOnly.tag')}</Tag>
          ) : null}
        </span>
      ),
    },
    {
      key: 'desc',
      title: t('clientConfig.col.desc'),
      render: (_, row) => <span style={wrap}>{keyText(intl, row.key, 'desc')}</span>,
    },
    {
      key: 'type',
      title: t('clientConfig.col.type'),
      render: (_, row) => typeText(intl, row.type),
    },
    {
      key: 'localized',
      title: t('clientConfig.col.localized'),
      render: (_, row) =>
        row.localized === true
          ? t('clientConfig.yes')
          : row.localized === false
            ? t('clientConfig.no')
            : DASH,
    },
    {
      key: 'configured',
      title: t('clientConfig.col.configured'),
      render: (_, row) =>
        row.readOnly === true ? (
          <Flex vertical gap={2}>
            <span>{t('clientConfig.configured.yes')}</span>
            <Typography.Text type="secondary" style={wrap}>
              {readOnlyNote(intl, row.key)}
            </Typography.Text>
            {canOpenSystemConfig ? (
              <Link to="/config">{t('clientConfig.readOnly.link')}</Link>
            ) : null}
          </Flex>
        ) : row.configured === true ? (
          t('clientConfig.configured.yes')
        ) : row.configured === false ? (
          t('clientConfig.configured.no')
        ) : (
          DASH
        ),
    },
    {
      key: 'usage',
      title: t('clientConfig.col.usage'),
      render: (_, row) => <span style={wrap}>{keyText(intl, row.key, 'usage')}</span>,
    },
    {
      key: 'actions',
      title: t('clientConfig.col.actions'),
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setOpen(row)}>
          {t(editableItem(row) ? 'clientConfig.edit' : 'clientConfig.view')}
        </Button>
      ),
    },
  ];

  const rows = (items ?? []).filter(isItem);

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('clientConfig.page.notice')} />
      <Typography.Text type="secondary">{t('clientConfig.page.hint')}</Typography.Text>
      {failure ? <FailureBar failure={failure} onRetry={reload} /> : null}
      <Table<ClientConfigItem>
        size="small"
        rowKey={(row) => plainText(row.key)}
        columns={columns}
        dataSource={rows}
        loading={loading && items === null}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('clientConfig.empty') }}
        pagination={{ pageSize: 20, hideOnSinglePage: true, pageSizeOptions: PAGE_SIZE_OPTIONS }}
        onRow={(row) => ({
          onClick: (event) => {
            // A press on a button or a link is that control's own.
            if ((event.target as HTMLElement).closest('button, a')) return;
            setOpen(row);
          },
          style: { cursor: 'pointer' },
        })}
      />
      {open ? (
        <ClientConfigEditor
          key={plainText(open.key)}
          item={open}
          editable={editableItem(open)}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      ) : null}
    </Flex>
  );
}
