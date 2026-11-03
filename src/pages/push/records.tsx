import { QuestionCircleOutlined } from '@ant-design/icons';
import { Link, useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Input,
  Select,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import {
  getRecord,
  listRecords,
  type Page,
  type PushDelivery,
  type PushRecord,
  type PushRecordDetail,
  type RecordFilters,
  TRIGGER_REASONS,
  type TriggerReason,
} from '../../services/push';
import { codeText, instantText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { lastNDaysUtc } from '../../utils/utcDay';

/** An account id as the backend takes it for the filter: 36 characters, hex digits in five groups. */
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Draft = {
  accountId: string;
  triggerReason: TriggerReason | undefined;
  /** Only the records created in `range` (UTC days); off, no date is sent. */
  byDay: boolean;
  range: DayRange;
};
/** The range that is on offer when the day filter is switched on. */
const newDraft = (): Draft => ({
  accountId: '',
  triggerReason: undefined,
  byDay: false,
  range: lastNDaysUtc(7),
});

/** An account id: any text, cut to two lines; a link to the user when the administrator may see users. */
function AccountCell({ accountId }: { accountId: unknown }) {
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const text = plainText(accountId);
  if (text === '') return <span>{DASH}</span>;
  if (typeof accountId === 'string' && access.canAccess('USER:VIEW')) {
    return (
      <Link
        to={`/users/${encodeURIComponent(accountId)}`}
        title={accountId}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: 260,
          overflowWrap: 'anywhere',
          wordBreak: 'break-all',
        }}
      >
        {accountId}
      </Link>
    );
  }
  return <EllipsisPopoverText text={text} lines={2} width={260} />;
}

/** The result for each token of one record, read when the row is opened. */
function Deliveries({ id }: { id: string }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [detail, setDetail] = useState<PushRecordDetail | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setDetail(null);
    clear();
    try {
      const record = await getRecord(id);
      if (isCurrent()) setDetail(record);
    } catch (error) {
      if (isCurrent()) fail(error);
    }
  }, [id, begin, clear, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('push.records.loadFailed', { message: failure })}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }
  if (detail === null) return <Spin />;
  if (detail.deliveries.length === 0) {
    return <Typography.Text type="secondary">{t('push.records.noDeliveries')}</Typography.Text>;
  }
  const columns: ColumnsType<PushDelivery & { __key: string }> = [
    {
      title: t('push.records.col.token'),
      dataIndex: 'pushTokenId',
      render: (value: unknown) => (
        <EllipsisPopoverText text={plainText(value)} lines={1} width={220} />
      ),
    },
    {
      title: t('push.records.col.platform'),
      dataIndex: 'platform',
      render: (value: unknown) => codeText(intl, 'push.platform', value) || DASH,
    },
    {
      title: t('push.records.col.tokenSuffix'),
      dataIndex: 'tokenSuffix',
      render: (value: unknown) => plainText(value) || DASH,
    },
    {
      title: t('push.records.col.result'),
      dataIndex: 'result',
      render: (value: unknown) => codeText(intl, 'push.result', value) || DASH,
    },
    {
      title: t('push.records.col.sentAt'),
      dataIndex: 'sentAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
  ];
  return (
    <Flex vertical gap={8} data-testid="deliveries">
      <Typography.Text strong>{t('push.records.deliveries')}</Typography.Text>
      <Table<PushDelivery & { __key: string }>
        size="small"
        rowKey="__key"
        columns={columns}
        dataSource={detail.deliveries.map((d, i) => ({ ...d, __key: `${plainText(d.id)}|${i}` }))}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Flex>
  );
}

/** 发送记录 (`PUSH:VIEW`): each push to an account; a row opens to the result for each token. */
export default function RecordsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [paging, setPaging] = useState({ page: 1, pageSize: 20 });
  // The filters being typed, and the ones the last Search applied (the list follows the second).
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [applied, setApplied] = useState<RecordFilters>({});
  const [accountProblem, setAccountProblem] = useState(false);
  const [data, setData] = useState<Page<PushRecord> | null>(null);
  const { text: failure, error: failed, fail, clear } = useFailure();
  const [loading, setLoading] = useState(true);
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setLoading(true);
    try {
      const page = await listRecords({ ...paging, ...applied });
      if (!isCurrent()) return;
      setData(page);
      clear();
    } catch (error) {
      if (isCurrent()) {
        // The rows of the read before belong to another filter: under the error bar there are none.
        setData(null);
        fail(error);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [paging, applied, begin, fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = () => {
    const accountId = trimSpec(draft.accountId);
    // The backend refuses an account id that is not an id; the page says so and sends nothing.
    if (accountId !== '' && !ACCOUNT_ID.test(accountId)) {
      setAccountProblem(true);
      return;
    }
    setAccountProblem(false);
    setApplied({
      ...(accountId === '' ? {} : { accountId }),
      ...(draft.triggerReason ? { triggerReason: draft.triggerReason } : {}),
      ...(draft.byDay ? { from: draft.range.from, to: draft.range.to } : {}),
    });
    setPaging((p) => ({ ...p, page: 1 }));
  };
  const reset = () => {
    setDraft(newDraft());
    setAccountProblem(false);
    setApplied({});
    setPaging((p) => ({ ...p, page: 1 }));
  };

  const columns: ColumnsType<PushRecord & { __key: string }> = [
    {
      title: t('push.records.col.account'),
      dataIndex: 'accountId',
      render: (value: unknown) => <AccountCell accountId={value} />,
    },
    {
      title: t('push.records.col.type'),
      dataIndex: 'pushType',
      render: (value: unknown) => codeText(intl, 'push.type', value) || plainText(value) || DASH,
    },
    {
      title: t('push.records.col.reason'),
      dataIndex: 'triggerReason',
      render: (value: unknown) => codeText(intl, 'push.reason', value) || plainText(value) || DASH,
    },
    {
      title: (
        <span>
          {t('push.records.col.localDate')}
          <Tooltip title={t('push.records.localDate.tip')}>
            <QuestionCircleOutlined
              data-testid="tip-localDate"
              aria-hidden={false}
              style={{ marginInlineStart: 4 }}
            />
          </Tooltip>
        </span>
      ),
      dataIndex: 'localDate',
      render: (value: unknown) => plainText(value) || DASH,
    },
    {
      title: t('push.records.col.createdAt'),
      dataIndex: 'createdAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('push.records.note')}
      </Typography.Paragraph>
      <Flex gap={8} wrap align="flex-start" role="search">
        <Flex vertical gap={4}>
          <Input
            allowClear
            style={{ width: 340 }}
            dir="ltr"
            aria-label={t('push.records.filter.account')}
            placeholder={t('push.records.filter.account')}
            status={accountProblem ? 'error' : undefined}
            value={draft.accountId}
            onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))}
            onPressEnter={search}
          />
          {accountProblem ? (
            <Typography.Text type="danger">
              {t('push.records.filter.accountInvalid')}
            </Typography.Text>
          ) : null}
        </Flex>
        <Select
          allowClear
          style={{ minWidth: 200 }}
          aria-label={t('push.records.filter.reason')}
          placeholder={t('push.records.filter.reason')}
          value={draft.triggerReason}
          options={TRIGGER_REASONS.map((r) => ({
            value: r,
            label: codeText(intl, 'push.reason', r),
          }))}
          onChange={(value) => setDraft((d) => ({ ...d, triggerReason: value ?? undefined }))}
        />
        <Flex vertical gap={4}>
          <Checkbox
            checked={draft.byDay}
            onChange={(e) => setDraft((d) => ({ ...d, byDay: e.target.checked }))}
          >
            {t('push.records.filter.dateRange')}
          </Checkbox>
          {draft.byDay ? (
            <DateRangeUtc
              value={draft.range}
              onChange={(range) => setDraft((d) => ({ ...d, range }))}
              refused={failed ?? undefined}
            />
          ) : null}
        </Flex>
        <Button type="primary" onClick={search}>
          {t('push.records.filter.search')}
        </Button>
        <Button onClick={reset}>{t('push.records.filter.reset')}</Button>
      </Flex>
      <Typography.Text type="secondary">{t('push.records.filter.note')}</Typography.Text>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      <Table<PushRecord & { __key: string }>
        size="middle"
        rowKey="__key"
        loading={loading}
        columns={columns}
        dataSource={(data?.items ?? []).map((r, i) => ({ ...r, __key: `${plainText(r.id)}|${i}` }))}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('push.records.empty') }}
        expandable={{ expandedRowRender: (row) => <Deliveries id={plainText(row.id)} /> }}
        pagination={{
          current: paging.page,
          pageSize: paging.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (page, pageSize) => setPaging({ page, pageSize }),
        }}
      />
    </Flex>
  );
}
