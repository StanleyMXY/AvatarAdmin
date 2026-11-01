import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { AutoComplete, Button, Flex, Form, Input, Table, Tooltip, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { type AnalyticsEvent, getEventNames, listEvents } from '../../services/analytics';
import { useAdminMeta } from '../../session/useSession';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { defaultRange } from './defaultRange';
import { ReadState } from './ReadState';
import { useRead } from './useRead';

const DEFAULT_PAGE_SIZE = 20;

type Filters = { accountId: string; deviceId: string; eventName: string };

const JSON_BOX: CSSProperties = {
  margin: 0,
  maxHeight: 320,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  overflowWrap: 'anywhere',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

/** A value of the event as formatted JSON; a dash when the event has none. */
function formatJson(value: unknown): string {
  if (value === null || value === undefined) return DASH;
  try {
    return JSON.stringify(value, null, 2) ?? DASH;
  } catch {
    return String(value);
  }
}

/** One entry of `context` as text; a dash when it is missing or not a plain value. */
function contextText(event: AnalyticsEvent, key: string): string {
  const context = event.context;
  if (typeof context !== 'object' || context === null) return DASH;
  const value = (context as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : DASH;
}

/** A column title with a question mark that says more. */
function TitleWithTip({ title, tip }: { title: string; tip: string }): ReactNode {
  return (
    <span>
      {title}{' '}
      <Tooltip title={tip}>
        <QuestionCircleOutlined />
      </Tooltip>
    </span>
  );
}

/**
 * 埋点管理 · 事件明细 (`ANALYTICS:VIEW`): single events of a UTC day range, newest first, by account,
 * device and event name. A row unfolds to the `params` and `context` the app sent. The IP is shown
 * exactly as the backend sends it (masked, or whole for `ANALYTICS:IP_VIEW`); the client time is
 * what the app wrote down itself and is marked as not trustworthy.
 */
export default function EventDetailPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [form] = Form.useForm<Filters>();
  const [range, setRange] = useState<DayRange>(() => defaultRange(meta.analyticsLiveMaxRangeDays));
  const [asked, setAsked] = useState<{ range: DayRange; filters: Filters }>({
    range,
    filters: { accountId: '', deviceId: '', eventName: '' },
  });
  const [paging, setPaging] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const fetcher = useCallback(
    () =>
      listEvents({
        ...asked.range,
        ...paging,
        accountId: asked.filters.accountId,
        deviceId: asked.filters.deviceId,
        eventName: asked.filters.eventName,
      }),
    [asked, paging],
  );
  const { data, failure, loading, reload } = useRead(fetcher, { keep: true });

  // The names the range has, for the suggestions. When they cannot be read the box is just a text box.
  const namesFetcher = useCallback(() => getEventNames(asked.range), [asked.range]);
  const names = useRead(namesFetcher, { keep: true }).data?.items ?? [];
  const nameOptions = useMemo(() => names.map((value) => ({ value })), [names]);

  const ask = (values: Partial<Filters>) => {
    setPaging((p) => ({ ...p, page: 1 }));
    setAsked({
      range: { ...range },
      filters: {
        accountId: trimSpec(values.accountId ?? ''),
        deviceId: trimSpec(values.deviceId ?? ''),
        eventName: trimSpec(values.eventName ?? ''),
      },
    });
  };

  return (
    <Flex vertical gap={16}>
      <Form<Filters> form={form} layout="inline" onFinish={ask} style={{ rowGap: 12 }}>
        <Form.Item label={t('analytics.detail.accountId')} name="accountId">
          <Input allowClear style={{ width: 160 }} />
        </Form.Item>
        <Form.Item label={t('analytics.detail.deviceId')} name="deviceId">
          <Input allowClear style={{ width: 240 }} />
        </Form.Item>
        <Form.Item label={t('analytics.common.eventName')} name="eventName">
          <AutoComplete
            allowClear
            style={{ width: 240 }}
            options={nameOptions}
            placeholder={t('analytics.detail.eventPlaceholder')}
            filterOption={(input, option) =>
              (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item style={{ width: '100%', marginInlineEnd: 0 }}>
          <Flex gap={12} wrap align="center">
            <DateRangeUtc
              value={range}
              onChange={setRange}
              maxDays={meta.analyticsLiveMaxRangeDays ?? undefined}
            />
            <Button type="primary" htmlType="submit">
              {t('analytics.common.query')}
            </Button>
            <UtcNotice />
          </Flex>
        </Form.Item>
      </Form>
      <ReadState failure={failure} loading={false} onRetry={reload} />
      <Table<AnalyticsEvent>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('analytics.detail.empty') }}
        pagination={{
          current: paging.page,
          pageSize: paging.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (page, pageSize) => setPaging({ page, pageSize }),
        }}
        expandable={{
          expandedRowRender: (row) => (
            <Flex vertical gap={12}>
              <div>
                <Typography.Text strong>{t('analytics.detail.params')}</Typography.Text>
                <pre data-testid="analytics-params" dir="auto" style={JSON_BOX}>
                  {formatJson(row.params)}
                </pre>
              </div>
              <div>
                <Typography.Text strong>{t('analytics.detail.context')}</Typography.Text>
                <pre data-testid="analytics-context" dir="auto" style={JSON_BOX}>
                  {formatJson(row.context)}
                </pre>
              </div>
            </Flex>
          ),
        }}
        columns={[
          {
            title: t('analytics.common.eventName'),
            dataIndex: 'eventName',
            render: (value: string) => <EllipsisPopoverText text={value} width={220} />,
          },
          {
            title: t('analytics.detail.col.account'),
            dataIndex: 'accountId',
            render: (value: string | null) => value || DASH,
          },
          {
            title: t('analytics.detail.col.device'),
            dataIndex: 'deviceId',
            render: (value: string) => <EllipsisPopoverText text={value} lines={1} width={200} />,
          },
          {
            title: (
              <TitleWithTip
                title={t('analytics.detail.col.receivedAt')}
                tip={t('analytics.detail.receivedAtTip')}
              />
            ),
            dataIndex: 'receivedAt',
            render: (value: string) => formatInstant(value, intl.locale),
          },
          {
            title: (
              <TitleWithTip
                title={t('analytics.detail.col.clientTime')}
                tip={t('analytics.detail.clientTimeTip')}
              />
            ),
            dataIndex: 'clientTime',
            render: (value: string | null) => (value ? formatInstant(value, intl.locale) : DASH),
          },
          {
            title: t('analytics.detail.col.platform'),
            key: 'platform',
            render: (_, row) => contextText(row, 'platform'),
          },
          {
            title: t('analytics.detail.col.appVersion'),
            key: 'appVersion',
            render: (_, row) => contextText(row, 'appVersion'),
          },
          {
            title: t('analytics.detail.col.country'),
            dataIndex: 'country',
            render: (value: string | null) => value || DASH,
          },
          {
            title: (
              <TitleWithTip
                title={t('analytics.detail.col.ip')}
                tip={t('analytics.detail.ipTip')}
              />
            ),
            dataIndex: 'ip',
            render: (value: string | null) => value || DASH,
          },
        ]}
      />
    </Flex>
  );
}
