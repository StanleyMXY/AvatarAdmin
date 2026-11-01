import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { EnabledSwitch } from '../../components/EnabledSwitch';
import { FailureBar } from '../../components/FailureBar';
import { PagedTable } from '../../components/PagedTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { useLatestRead } from '../../hooks/useLatestRead';
import { useServerPage } from '../../hooks/useServerPage';
import {
  deleteChannel,
  getSmsMeta,
  listChannels,
  loadAllPages,
  SMS_TYPES,
  type SmsChannel,
  setChannelEnabled,
} from '../../services/sms';
import { countText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { asCoverage, ChannelModal } from './ChannelModal';
import { isLastOtpChannel } from './lastOtp';
import { TestSendModal } from './TestSendModal';
import { guardedFailureText, useLastOtpPrompt } from './useLastOtpPrompt';

const NO_FILTERS: Record<string, never> = {};
/** An enabled OTP row: when the backend refuses to delete or switch it off, the reason is the rule of contract 23.4, last or not (the page may not have known that it was the last). */
const servesCodes = (row: { enabled?: unknown; smsType?: unknown }): boolean =>
  row.enabled === true && plainText(row.smsType) === 'OTP';
const isRecord = (row: unknown): row is SmsChannel => typeof row === 'object' && row !== null;

/**
 * 渠道: the SMS channels (SMS:CHANNEL to read; SMS:CHANNEL:CONFIG to create, change, switch, delete
 * and test). Credentials are write-only: the page reads `hasCredentials` and nothing else about
 * them, and the dialog never fills the box. Before the last enabled OTP channel of a country is
 * switched off, deleted or changed so that it stops serving, the page asks, naming the two
 * conditions under which the backend refuses (contract 23.4).
 */
export default function ChannelsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canConfig = access.canAccess('SMS:CHANNEL:CONFIG');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ask = useLastOtpPrompt();
  const [editing, setEditing] = useState<SmsChannel | 'new' | null>(null);
  const [testing, setTesting] = useState<SmsChannel | null>(null);

  const state = useServerPage<SmsChannel, Record<string, never>>(
    (query) => listChannels({ page: query.page, pageSize: query.pageSize }),
    NO_FILTERS,
  );
  // Every channel, for the question about the last one and for the codes that are taken.
  const readAll = useCallback(
    () => loadAllPages((page, pageSize) => listChannels({ page, pageSize })),
    [],
  );
  const every = useLatestRead(readAll);
  const meta = useLatestRead(getSmsMeta);
  const refresh = () => {
    state.reload();
    every.reload();
  };

  const all = every.data ? every.data.filter(isRecord) : null;
  /** Without the list of every channel an enabled OTP channel is taken as the last one: the question is asked. */
  const isLast = (row: SmsChannel): boolean => {
    if (!(row.enabled === true && plainText(row.smsType) === 'OTP')) return false;
    if (all === null) return true;
    return isLastOtpChannel(asCoverage(row), all.map(asCoverage));
  };

  const remove = async (row: SmsChannel, guarded: boolean) => {
    try {
      await deleteChannel(plainText(row.id));
      message.success(t('sms.common.deleted'));
    } catch (error) {
      message.error(guardedFailureText(intl, error, guarded));
    }
    refresh();
  };

  const actionsOf = (row: SmsChannel): RowAction[] => {
    if (!canConfig) return [];
    const last = isLast(row);
    return [
      { key: 'edit', label: t('sms.common.edit'), onClick: () => setEditing(row) },
      { key: 'test', label: t('sms.channels.test'), onClick: () => setTesting(row) },
      last
        ? {
            key: 'delete',
            label: t('sms.common.delete'),
            onClick: async () => {
              if (await ask('delete', 'channel')) await remove(row, servesCodes(row));
            },
          }
        : {
            key: 'delete',
            label: t('sms.common.delete'),
            confirmText: t('sms.channels.deleteAsk'),
            onClick: () => remove(row, servesCodes(row)),
          },
    ];
  };

  const typeOptions = Object.fromEntries(
    SMS_TYPES.map((type) => [
      type,
      { label: t(`sms.type.${type}`), color: type === 'OTP' ? 'blue' : undefined },
    ]),
  );

  const columns: ColumnsType<SmsChannel> = [
    {
      key: 'code',
      title: t('sms.channels.col.code'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.channelCode)} lines={2} width={200} dir="ltr" />
      ),
    },
    {
      key: 'name',
      title: t('sms.channels.col.name'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={220} />,
    },
    {
      key: 'provider',
      title: t('sms.channels.col.provider'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.providerCode)} lines={2} width={160} dir="ltr" />
      ),
    },
    {
      key: 'type',
      title: t('sms.channels.col.type'),
      render: (_, row) => <StatusTag status={plainText(row.smsType)} options={typeOptions} />,
    },
    {
      key: 'countries',
      title: t('sms.channels.col.countries'),
      render: (_, row) => {
        if (!Array.isArray(row.countries)) {
          return row.countries === null || row.countries === undefined
            ? t('sms.channels.allCountries')
            : plainText(row.countries);
        }
        if (row.countries.length === 0) return t('sms.channels.allCountries');
        return (
          <Flex wrap gap={4} style={{ maxWidth: 200 }}>
            {row.countries.map((code, i) => (
              // The same code can be listed twice by a backend that went wrong; the position keeps the keys apart.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <Tag key={`${plainText(code)}-${i}`} style={{ marginInlineEnd: 0 }}>
                {plainText(code)}
              </Tag>
            ))}
          </Flex>
        );
      },
    },
    {
      key: 'priority',
      title: t('sms.channels.col.priority'),
      align: 'end',
      render: (_, row) => countText(intl.locale, row.priority),
    },
    {
      key: 'enabled',
      title: t('sms.channels.col.enabled'),
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled === true}
          label={t('sms.channels.switchLabel', { code: plainText(row.channelCode) })}
          disabled={!canConfig}
          onToggle={async (next) => {
            if (!next && isLast(row) && !(await ask('disable', 'channel'))) return;
            await setChannelEnabled(plainText(row.id), next);
          }}
          failureText={(error, next) => guardedFailureText(intl, error, !next && servesCodes(row))}
          onDone={refresh}
        />
      ),
    },
    {
      key: 'credentials',
      title: t('sms.channels.col.credentials'),
      render: (_, row) =>
        row.hasCredentials === true ? (
          <Tag color="green">{t('sms.channels.credentials.set')}</Tag>
        ) : row.hasCredentials === false ? (
          <Tag>{t('sms.channels.credentials.notSet')}</Tag>
        ) : (
          '—'
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
      <Alert type="info" showIcon title={t('sms.channels.note.selection')} />
      <Alert type="info" showIcon title={t('sms.channels.note.credentials')} />
      {meta.failure !== null ? <FailureBar failure={meta.failure} onRetry={meta.reload} /> : null}
      <Flex gap={8} wrap align="center">
        {canConfig ? (
          <Button type="primary" onClick={() => setEditing('new')}>
            {t('sms.channels.new')}
          </Button>
        ) : (
          <Typography.Text type="secondary">{t('sms.channels.readOnly')}</Typography.Text>
        )}
      </Flex>
      <PagedTable<SmsChannel>
        state={shown}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('sms.channels.empty')}
      />
      {/* Mounted only while open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <ChannelModal
          channel={editing === 'new' ? null : editing}
          providers={meta.data?.providers ?? []}
          all={all}
          ask={ask}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      {testing !== null ? (
        <TestSendModal channel={testing} onClose={() => setTesting(null)} />
      ) : null}
    </Flex>
  );
}
