import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { FailureBar } from '../../components/FailureBar';
import { useLatestRead } from '../../hooks/useLatestRead';
import { type EmailTemplate, listEmailTemplates } from '../../services/email';
import { plainText } from '../../utils/plainText';
import { TemplateEditor } from './TemplateEditor';
import { adminText, instantText } from './texts';

const isRecord = (row: unknown): row is EmailTemplate => typeof row === 'object' && row !== null;

/**
 * 邮件模板: the templates of the e-mails that the system sends (EMAIL:TEMPLATE for everything on
 * this page). There is one English text per template; the templates are declared by the backend, so
 * the list is whatever it returns, in its order, and a code that this page has never heard of is
 * shown and edited like the others.
 */
export default function EmailTemplatesPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const list = useLatestRead(listEmailTemplates);
  const rows = (list.data ?? []).filter(isRecord);

  const describe = (code: string): string | null =>
    intl.messages[`email.code.${code}`] ? t(`email.code.${code}`) : null;

  const columns: ColumnsType<EmailTemplate> = [
    {
      key: 'code',
      title: t('email.templates.col.code'),
      render: (_, row) => {
        const code = plainText(row.templateCode);
        const meaning = describe(code);
        return (
          <Flex vertical>
            <Typography.Text strong data-kind="code">
              <EllipsisPopoverText text={code} lines={2} width={240} dir="ltr" />
            </Typography.Text>
            {meaning ? (
              <Typography.Text type="secondary" data-kind="description">
                {meaning}
              </Typography.Text>
            ) : null}
          </Flex>
        );
      },
    },
    {
      key: 'subject',
      title: t('email.templates.col.subject'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.subject)} lines={2} width={320} />
      ),
    },
    {
      key: 'status',
      title: t('email.templates.col.status'),
      render: (_, row) =>
        row.modified === true ? (
          <Tag color="orange">{t('email.templates.status.modified')}</Tag>
        ) : (
          <Tag>{t('email.templates.status.default')}</Tag>
        ),
    },
    {
      key: 'updatedBy',
      title: t('email.templates.col.updatedBy'),
      render: (_, row) => adminText(row.updatedByUsername, row.updatedBy),
    },
    {
      key: 'updatedAt',
      title: t('email.templates.col.updatedAt'),
      render: (_, row) => instantText(intl.locale, row.updatedAt),
    },
    {
      key: 'actions',
      title: t('email.templates.col.actions'),
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setEditing(row)}>
          {t('email.templates.edit')}
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('email.templates.note')} />
      {list.failure !== null ? <FailureBar failure={list.failure} onRetry={list.reload} /> : null}
      <Table<EmailTemplate>
        size="small"
        rowKey={(row) => plainText(row.templateCode)}
        columns={columns}
        dataSource={rows}
        loading={list.data === null && list.failure === null}
        scroll={{ x: 'max-content' }}
        pagination={false}
        locale={{ emptyText: t('email.templates.empty') }}
      />
      {/* Mounted only while open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onChanged={list.reload}
        />
      ) : null}
    </Flex>
  );
}
