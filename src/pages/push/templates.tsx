import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Spin, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { EnabledSwitch } from '../../components/EnabledSwitch';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import {
  deleteTemplate,
  listAllTemplates,
  listTemplates,
  type MissingLocales,
  type PushTemplate,
  updateTemplate,
} from '../../services/push';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { codeText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { coverage, supportedLocalesOf } from './coverage';
import { PushImage } from './PushImage';
import { templateFailureText } from './recallRule';
import { TemplateMatrix } from './TemplateMatrix';
import { TemplateModal } from './TemplateModal';
import { describeLink } from './texts';

/**
 * 模板 (`PUSH:TEMPLATE`): the words of the recall pushes, one template for each trigger reason and
 * language. The matrix on top shows which languages fall back to the default language (what the
 * backend lists in `missingLocales`). The rule that a reason with an enabled template needs an
 * enabled one in the default language is the backend's: the page sends the request and shows the
 * words of its refusal.
 */
export default function TemplatesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('PUSH:TEMPLATE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const locales = supportedLocalesOf(useAdminMeta() as { supportedLocales?: unknown });
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<PushTemplate | null | 'new'>(null);
  const [all, setAll] = useState<PushTemplate[] | null>(null);
  const [missing, setMissing] = useState<MissingLocales | null>(null);
  const [allFailure, setAllFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const loadAll = useCallback(async () => {
    const mine = ++counter.current;
    try {
      const rows = await listAllTemplates();
      if (mine !== counter.current) return;
      setAll(rows.items);
      setMissing(rows.missingLocales);
      setAllFailure(null);
    } catch (error) {
      if (mine === counter.current) setAllFailure(describeFailure(intl, error).text);
    }
  }, [intl]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const reload = () => {
    ref.current?.reload();
    void loadAll();
  };

  const rows = useMemo(
    () => (all && locales ? coverage(all, locales, missing) : null),
    [all, locales, missing],
  );

  const columns: ProColumns<PushTemplate>[] = [
    {
      title: t('push.templates.col.reason'),
      dataIndex: 'triggerReason',
      search: false,
      render: (_, row) => codeText(intl, 'push.reason', row.triggerReason),
    },
    {
      title: t('push.templates.col.locale'),
      dataIndex: 'locale',
      search: false,
      render: (_, row) => plainText(row.locale),
    },
    {
      title: t('push.templates.col.enabled'),
      dataIndex: 'enabled',
      search: false,
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled === true}
          disabled={!canWrite}
          label={t('push.templates.enabledOf', {
            reason: codeText(intl, 'push.reason', row.triggerReason),
            locale: plainText(row.locale),
          })}
          onToggle={async (next) => {
            await updateTemplate(row.id, {
              title: plainText(row.title),
              body: plainText(row.body),
              linkType: row.linkType,
              linkTarget: plainText(row.linkTarget),
              enabled: next,
            });
          }}
          failureText={(error) => templateFailureText(intl, error, { reasons: true })}
          onDone={reload}
        />
      ),
    },
    {
      title: t('push.templates.col.title'),
      dataIndex: 'title',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.title)} lines={2} width={200} />,
    },
    {
      title: t('push.templates.col.body'),
      dataIndex: 'body',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.body)} lines={2} width={260} />,
    },
    {
      title: t('push.templates.col.link'),
      dataIndex: 'linkType',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText
          text={describeLink(intl, row.linkType, row.linkTarget)}
          lines={2}
          width={200}
        />
      ),
    },
    {
      title: t('push.templates.col.image'),
      dataIndex: 'imageUrl',
      search: false,
      render: (_, row) => <PushImage url={row.imageUrl} />,
    },
    {
      title: t('push.templates.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) =>
        canWrite ? (
          <RowActions
            actions={[
              { key: 'edit', label: t('push.templates.edit'), onClick: () => setEditing(row) },
              {
                key: 'delete',
                label: t('push.templates.delete'),
                confirmText: t('push.templates.deleteConfirm'),
                onClick: async () => {
                  try {
                    await deleteTemplate(row.id);
                    message.success(t('push.templates.deleted'));
                  } catch (error) {
                    message.error(templateFailureText(intl, error, { reasons: true }));
                  }
                  reload();
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('push.templates.note')}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }} data-testid="push-howto">
        {t('push.templates.noteHowTo')}
      </Typography.Paragraph>
      {locales === null ? (
        <Alert type="info" showIcon title={t('push.templates.matrix.unknown')} />
      ) : allFailure ? (
        <Alert
          type="error"
          showIcon
          title={t('push.templates.matrix.loadFailed', { message: allFailure })}
          action={
            <Button size="small" onClick={() => void loadAll()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : rows && locales ? (
        <TemplateMatrix rows={rows} locales={locales} />
      ) : (
        <Spin />
      )}
      <PagedListTable<PushTemplate>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={async ({ page, pageSize }) => {
          const answer = await listTemplates({ page, pageSize });
          if (typeof answer.total === 'number') return { items: answer.items, total: answer.total };
          // No total in the answer (the backend's list has none): the table shows what was read, all of it.
          const every = (await listAllTemplates()).items;
          return {
            items: every.slice((page - 1) * pageSize, page * pageSize),
            total: every.length,
          };
        }}
        toolbar={
          canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('push.templates.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <TemplateModal
        open={editing !== null}
        template={editing === 'new' || editing === null ? null : editing}
        templates={all ?? []}
        locales={locales}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </Flex>
  );
}
