import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { EnabledSwitch } from '../../components/EnabledSwitch';
import { PagedTable } from '../../components/PagedTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { useLatestRead } from '../../hooks/useLatestRead';
import { useServerPage } from '../../hooks/useServerPage';
import {
  deleteTemplate,
  listTemplates,
  loadAllPages,
  SMS_TYPES,
  type SmsTemplate,
  setTemplateEnabled,
} from '../../services/sms';
import { orDash } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { isLastEnglishFallbackTemplate, isLastOtpTemplate } from './lastOtp';
import { TemplateModal } from './TemplateModal';
import { templateFailureText } from './templateFailure';
import { useLastOtpPrompt } from './useLastOtpPrompt';

const NO_FILTERS: Record<string, never> = {};
/** An enabled OTP row: when the backend refuses to delete or switch it off, the reason is the rule of contract 23.4, last or not (the page may not have known that it was the last). */
const servesCodes = (row: { enabled?: unknown; smsType?: unknown }): boolean =>
  row.enabled === true && plainText(row.smsType) === 'OTP';
const isRecord = (row: unknown): row is SmsTemplate => typeof row === 'object' && row !== null;
const asCoverage = (t: Partial<SmsTemplate>) => ({
  id: plainText(t.id),
  enabled: t.enabled === true,
  smsType: plainText(t.smsType),
  locale: t.locale,
  country: t.country,
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
  /** The last enabled OTP template in English with no country (contract 23.4, e2): asked first as far as the list shows it; the backend has the last word. */
  const isLastEnglish = (row: SmsTemplate): boolean => {
    if (all === null) return isLastEnglishFallbackTemplate(asCoverage(row), []);
    return isLastEnglishFallbackTemplate(asCoverage(row), all.map(asCoverage));
  };
  /** Which question a switch-off, delete or change of this row needs first, if any: the broader rule (the last OTP template at all) before the narrower one. */
  const questionFor = (row: SmsTemplate): 'template' | 'englishTemplate' | null =>
    isLast(row) ? 'template' : isLastEnglish(row) ? 'englishTemplate' : null;

  const remove = async (row: SmsTemplate, guarded: boolean) => {
    try {
      await deleteTemplate(plainText(row.id));
      message.success(t('sms.common.deleted'));
    } catch (error) {
      message.error(templateFailureText(intl, error, guarded));
    }
    refresh();
  };

  const actionsOf = (row: SmsTemplate): RowAction[] => [
    { key: 'edit', label: t('sms.common.edit'), onClick: () => setEditing(row) },
    questionFor(row) !== null
      ? {
          key: 'delete',
          label: t('sms.common.delete'),
          onClick: async () => {
            const question = questionFor(row);
            if (question !== null && (await ask('delete', question))) {
              await remove(row, servesCodes(row));
            }
          },
        }
      : {
          key: 'delete',
          label: t('sms.common.delete'),
          confirmText: t('sms.templates.deleteAsk'),
          onClick: () => remove(row, servesCodes(row)),
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
        <EllipsisPopoverText text={plainText(row.templateCode)} lines={2} width={200} dir="ltr" />
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
        <EllipsisPopoverText
          text={orDash(row.providerTemplateId)}
          lines={2}
          width={180}
          dir="ltr"
        />
      ),
    },
    {
      key: 'enabled',
      title: t('sms.templates.col.enabled'),
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled === true}
          label={t('sms.templates.switchLabel', { code: plainText(row.templateCode) })}
          onToggle={async (next) => {
            const question = questionFor(row);
            if (!next && question !== null && !(await ask('disable', question))) return;
            await setTemplateEnabled(plainText(row.id), next);
          }}
          failureText={(error, next) => templateFailureText(intl, error, !next && servesCodes(row))}
          onDone={refresh}
        />
      ),
    },
    {
      ...ACTIONS_COLUMN,
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
