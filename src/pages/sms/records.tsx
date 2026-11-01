import { useAccess, useIntl } from '@umijs/max';
import { Button, Flex, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { StatusTag } from '../../components/StatusTag';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  listRecords,
  RECORD_PURPOSES,
  type RecordQuery,
  SEND_STATUSES,
  SMS_RECORDS_EXPORT_URL,
  type SmsRecord,
} from '../../services/sms';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { lastNDaysUtc, utcDayRangeToInstants } from '../../utils/utcDay';
import { PagedTable } from './PagedTable';
import { instantText, orDash } from './texts';
import { useServerPage } from './useServerPage';

type Filters = {
  msgId: string;
  vendorMsgId: string;
  mobile: string;
  channel: string;
  channelCode: string;
  purpose: string;
  sendStatus: string;
  deliveryStatus: string;
  used: '' | 'true' | 'false';
  range: DayRange;
};

const DEFAULT_DAYS = 7;
const initialFilters = (): Filters => ({
  msgId: '',
  vendorMsgId: '',
  mobile: '',
  channel: '',
  channelCode: '',
  purpose: '',
  sendStatus: '',
  deliveryStatus: '',
  used: '',
  range: lastNDaysUtc(DEFAULT_DAYS),
});

const isRecord = (row: unknown): row is SmsRecord => typeof row === 'object' && row !== null;

/** The filters that have a value, as the backend names them (the days become instants of the UTC days). */
function paramsOf(filters: Filters) {
  const { from, to } = utcDayRangeToInstants(filters.range.from, filters.range.to);
  const params: Omit<RecordQuery, 'page' | 'pageSize'> = { from, to };
  if (filters.msgId) params.msgId = filters.msgId;
  if (filters.vendorMsgId) params.vendorMsgId = filters.vendorMsgId;
  if (filters.mobile) params.mobile = filters.mobile;
  if (filters.channel) params.channel = filters.channel as RecordQuery['channel'];
  if (filters.channelCode) params.channelCode = filters.channelCode;
  if (filters.purpose) params.purpose = filters.purpose as RecordQuery['purpose'];
  if (filters.sendStatus) params.sendStatus = filters.sendStatus as RecordQuery['sendStatus'];
  if (filters.deliveryStatus) {
    params.deliveryStatus = filters.deliveryStatus as RecordQuery['deliveryStatus'];
  }
  if (filters.used) params.used = filters.used === 'true';
  return params;
}

const SEND_COLOR: Record<string, string | undefined> = {
  QUEUED: undefined,
  SENDING: 'processing',
  SUCCESS: 'green',
  FAILED: 'red',
};
const DELIVERY_COLOR: Record<string, string | undefined> = {
  PENDING: 'orange',
  DELIVERED: 'green',
  FAILED: 'red',
};

/**
 * 发送记录: the send records, read only (SMS:RECORD). The number is shown exactly as the backend
 * gives it: masked to its last four digits, and whole only for an administrator with
 * SMS:RECORD:PHONE_VIEW; nothing here masks or unmasks it. There is no way to see a code: the text
 * has it replaced by `****`. A record that went out as a push has no provider message ID and no
 * delivery status. The export (SMS:RECORD:EXPORT, with SMS:RECORD) follows the filters of the last
 * search.
 */
export default function RecordsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(draft);
  const seesPhone = access.canAccess('SMS:RECORD:PHONE_VIEW');

  const state = useServerPage<SmsRecord, Filters>((query) => {
    const { page, pageSize, ...filters } = query;
    return listRecords({ page, pageSize, ...paramsOf(filters as Filters) });
  }, applied);
  const exportParams = useMemo(() => paramsOf(applied), [applied]);

  const search = () => {
    setApplied({
      ...draft,
      msgId: trimSpec(draft.msgId),
      vendorMsgId: trimSpec(draft.vendorMsgId),
      mobile: trimSpec(draft.mobile),
      channelCode: trimSpec(draft.channelCode),
    });
    state.search();
  };

  const labelled = (prefix: string, codes: readonly string[]) =>
    codes.map((code) => ({ value: code, label: t(`${prefix}.${code}`) }));
  const optionsOf = (prefix: string, colors: Record<string, string | undefined>) =>
    Object.fromEntries(
      Object.entries(colors).map(([code, color]) => [
        code,
        { label: t(`${prefix}.${code}`), color },
      ]),
    );
  const sendOptions = optionsOf('sms.records.sendStatus', SEND_COLOR);
  const deliveryOptions = optionsOf('sms.records.deliveryStatus', DELIVERY_COLOR);

  const dash = <span>—</span>;
  const columns: ColumnsType<SmsRecord> = [
    {
      key: 'msgId',
      title: t('sms.records.col.msgId'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.msgId)} lines={2} width={180} dir="ltr" />
      ),
    },
    {
      key: 'vendorMsgId',
      title: t('sms.records.col.vendorMsgId'),
      render: (_, row) =>
        row.channel === 'PUSH' ? (
          dash
        ) : (
          <EllipsisPopoverText text={orDash(row.vendorMsgId)} lines={2} width={180} dir="ltr" />
        ),
    },
    {
      key: 'mobile',
      title: t('sms.records.col.mobile'),
      render: (_, row) => (
        <span dir="ltr" style={{ overflowWrap: 'anywhere' }}>
          {orDash(row.mobile)}
        </span>
      ),
    },
    {
      key: 'country',
      title: t('sms.records.col.country'),
      render: (_, row) => orDash(row.country),
    },
    {
      key: 'purpose',
      title: t('sms.records.col.purpose'),
      render: (_, row) => {
        const code = plainText(row.purpose);
        return intl.messages[`sms.records.purpose.${code}`]
          ? t(`sms.records.purpose.${code}`)
          : orDash(code);
      },
    },
    {
      key: 'channel',
      title: t('sms.records.col.deliveryChannel'),
      render: (_, row) => {
        const code = plainText(row.channel);
        return intl.messages[`sms.records.channel.${code}`]
          ? t(`sms.records.channel.${code}`)
          : orDash(code);
      },
    },
    {
      key: 'channelCode',
      title: t('sms.records.col.channelCode'),
      render: (_, row) => (
        <EllipsisPopoverText text={orDash(row.channelCode)} lines={2} width={160} dir="ltr" />
      ),
    },
    {
      key: 'sendStatus',
      title: t('sms.records.col.sendStatus'),
      render: (_, row) => <StatusTag status={plainText(row.sendStatus)} options={sendOptions} />,
    },
    {
      key: 'deliveryStatus',
      title: t('sms.records.col.deliveryStatus'),
      render: (_, row) =>
        row.channel === 'PUSH' ? (
          dash
        ) : (
          <StatusTag status={plainText(row.deliveryStatus)} options={deliveryOptions} />
        ),
    },
    {
      key: 'used',
      title: t('sms.records.col.used'),
      render: (_, row) =>
        row.usedAt === null || row.usedAt === undefined || row.usedAt === ''
          ? t('sms.records.notUsed')
          : instantText(intl.locale, row.usedAt),
    },
    {
      key: 'failReason',
      title: t('sms.records.col.failReason'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.failReason)} lines={2} width={200} />
      ),
    },
    {
      key: 'content',
      title: t('sms.records.col.content'),
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.contentRedacted)} lines={2} width={280} />
      ),
    },
    {
      key: 'createdAt',
      title: t('sms.records.col.createdAt'),
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    {
      key: 'sentAt',
      title: t('sms.records.col.sentAt'),
      render: (_, row) => instantText(intl.locale, row.sentAt),
    },
  ];

  const shown = { ...state, rows: state.rows.filter(isRecord) };
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const text = (
    key: 'msgId' | 'vendorMsgId' | 'mobile' | 'channelCode',
    label: string,
    width = 200,
  ) => (
    <Input
      allowClear
      style={{ width }}
      dir="auto"
      aria-label={label}
      placeholder={label}
      value={draft[key]}
      onChange={(e) => set(key, e.target.value)}
      onPressEnter={search}
    />
  );
  const choose = (
    key: 'channel' | 'purpose' | 'sendStatus' | 'deliveryStatus' | 'used',
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Select
      allowClear
      style={{ minWidth: 150 }}
      aria-label={label}
      placeholder={label}
      value={draft[key] || undefined}
      options={options}
      onChange={(value) => set(key, (value ?? '') as never)}
    />
  );

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap align="center">
        {text('msgId', t('sms.records.filter.msgId'))}
        {text('vendorMsgId', t('sms.records.filter.vendorMsgId'))}
        {text('mobile', t('sms.records.filter.mobile'), 220)}
        {choose(
          'channel',
          t('sms.records.filter.deliveryChannel'),
          labelled('sms.records.channel', DELIVERY_CHANNELS),
        )}
        {text('channelCode', t('sms.records.filter.channelCode'), 160)}
        {choose(
          'purpose',
          t('sms.records.filter.purpose'),
          labelled('sms.records.purpose', RECORD_PURPOSES),
        )}
        {choose(
          'sendStatus',
          t('sms.records.filter.sendStatus'),
          labelled('sms.records.sendStatus', SEND_STATUSES),
        )}
        {choose(
          'deliveryStatus',
          t('sms.records.filter.deliveryStatus'),
          labelled('sms.records.deliveryStatus', DELIVERY_STATUSES),
        )}
        {choose('used', t('sms.records.filter.used'), [
          { value: 'true', label: t('sms.records.used.yes') },
          { value: 'false', label: t('sms.records.used.no') },
        ])}
        <DateRangeUtc value={draft.range} onChange={(range) => set('range', range)} />
        <Button type="primary" onClick={search}>
          {t('sms.common.search')}
        </Button>
        <ExportButton
          name="sms-records"
          url={SMS_RECORDS_EXPORT_URL}
          params={exportParams}
          viewCode="SMS:RECORD"
          requiredCodes={['SMS:RECORD:EXPORT', 'SMS:RECORD']}
        />
      </Flex>
      <Typography.Text type="secondary">{t('sms.records.note.mobile')}</Typography.Text>
      <Typography.Text type="secondary">{t('sms.records.note.range')}</Typography.Text>
      {seesPhone ? null : (
        <Typography.Text type="secondary">
          {`${t('sms.records.note.masked')} ${t('pages.masked.needsPermission', {
            name: intl.messages['permission.SMS:RECORD:PHONE_VIEW']
              ? t('permission.SMS:RECORD:PHONE_VIEW')
              : 'SMS:RECORD:PHONE_VIEW',
          })}`}
        </Typography.Text>
      )}
      <PagedTable<SmsRecord>
        state={shown}
        columns={columns}
        rowKey={(row) => plainText(row.msgId)}
        emptyText={t('sms.records.empty')}
      />
    </Flex>
  );
}
