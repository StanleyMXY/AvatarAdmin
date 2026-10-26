import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  deleteTemplate,
  listTemplates,
  loadAllPages,
  SMS_TYPES,
  type SmsTemplate,
  setTemplateEnabled,
} from '../../services/sms';
import { plainText } from '../../utils/plainText';
import { isLastOtpTemplate } from './lastOtp';
import { PagedTable } from './PagedTable';
import { StatusSwitch } from './StatusSwitch';
import { TemplateModal } from './TemplateModal';
import { orDash } from './texts';
import { guardedFailureText, useLastOtpPrompt } from './useLastOtpPrompt';
import { useLatestRead } from './useLatestRead';
import { useServerPage } from './useServerPage';

const NO_FILTERS: Record<string, never> = {};
const isRecord = (row: unknown): row is SmsTemplate => typeof row === 'object' && row !== null;
const asCoverage = (t: Partial<SmsTemplate>) => ({
  id: plainText(t.id),
  enabled: t.enabled === true,
  smsType: plainText(t.smsType),
});

/**
 * 模板: the SMS templates (SMS:TEMPLATE for everything on this page). The rule that chooses a
 * template for a send is written at the top. An OTP template must hold `{code}`. The last enabled
 * OTP template cannot be switched off or deleted (contract 23.4): the page asks first, and the
 * backend has the last word.
 */
export default function TemplatesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ask = useLastOtpPrompt();
  const [editing, setEditing] = useState<SmsTemplate | 'new' | null>(null);

  const state = useServerPage<SmsTemplate, Record<string, never>>(
    (query) => listTemplates({ page: query.page, pageSize: query.pageSize }),
    NO_FILTERS,
  );
  const readAll = useCallback(
    () => loadAllPages((page, pageSize) => listTemplates({ page, pageSize })),
    [],
  );
  const every = useLatestRead(readAll);
  const refresh = () => {
    state.reload();
    every.reload();
  };

  const all = every.data ? every.data.filter(isRecord) : null;
  /** Without the list of every template an enabled OTP template is taken as the last one: the question is asked. */
  const isLast = (row: SmsTemplate): boolean => {
    if (!(row.enabled === true && plainText(row.smsType) === 'OTP')) return false;
    if (all === null) return true;
    return isLastOtpTemplate(asCoverage(row), all.map(asCoverage));
  };

  const remove = async (row: SmsTemplate, guarded: boolean) => {
    try {
      await deleteTemplate(plainText(row.id));
      message.success(t('sms.common.deleted'));
    } catch (error) {
      message.error(guardedFailureText(intl, error, guarded));
    }
    refresh();
  };

  const actionsOf = (row: SmsTemplate): RowAction[] => [
    { key: 'edit', label: t('sms.common.edit'), onClick: () => setEditing(row) },
    isLast(row)
      ? {
          key: 'delete',
          label: t('sms.common.delete'),
          onClick: async () => {
            if (await ask('delete', 'template')) await remove(row, true);
          },
        }
      : {
          key: 'delete',
          label: t('sms.common.delete'),
          confirmText: t('sms.templates.deleteAsk'),
          onClick: () => remove(row, false),
        },
  ];

  const typeOptions = Object.fromEntries(
    SMS_TYPES.map((type) => [
      type,
      { label: t(`sms.type.${type}`), color: type === 'OTP' ? 'blue' : undefined },
    ]),
  );

  const columns: ColumnsType<SmsTemplate> = [
    {
      key: 'code',
      title: t('sms.templates.col.code'),
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{plainText(row.templateCode)}</span>
      ),
    },
    {
      key: 'name',
      title: t('sms.templates.col.name'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={180} />,
    },
    {
      key: 'type',
      title: t('sms.templates.col.type'),
      render: (_, row) => <StatusTag status={plainText(row.smsType)} options={typeOptions} />,
    },
    {
      key: 'locale',
      title: t('sms.templates.col.locale'),
      render: (_, row) => orDash(row.locale),
    },
    {
      key: 'country',
      title: t('sms.templates.col.country'),
      render: (_, row) => orDash(row.country),
    },
    {
      key: 'content',
      title: t('sms.templates.col.content'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.content)} lines={3} width={360} />
      ),
    },
    {
      key: 'providerTemplateId',
      title: t('sms.templates.col.providerTemplateId'),
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{orDash(row.providerTemplateId)}</span>
      ),
    },
    {
      key: 'enabled',
      title: t('sms.templates.col.enabled'),
      render: (_, row) => (
        <StatusSwitch
          checked={row.enabled === true}
          label={t('sms.templates.switchLabel', { code: plainText(row.templateCode) })}
          onToggle={async (next) => {
            if (!next && isLast(row) && !(await ask('disable', 'template'))) return;
            await setTemplateEnabled(plainText(row.id), next);
          }}
          failureText={(error, next) => guardedFailureText(intl, error, !next && isLast(row))}
          onDone={refresh}
        />
      ),
    },
    {
      key: 'actions',
      title: t('sms.common.actions'),
      render: (_, row) => <RowActions actions={actionsOf(row)} />,
    },
  ];

  const shown = { ...state, rows: state.rows.filter(isRecord) };

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('sms.templates.note.rule')} />
      <Flex gap={8} wrap align="center">
        <Button type="primary" onClick={() => setEditing('new')}>
          {t('sms.templates.new')}
        </Button>
      </Flex>
      <PagedTable<SmsTemplate>
        state={shown}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('sms.templates.empty')}
      />
      {/* Mounted only while open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <TemplateModal
          template={editing === 'new' ? null : editing}
          all={all}
          ask={ask}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </Flex>
  );
}
