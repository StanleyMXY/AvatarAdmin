import { useIntl } from '@umijs/max';
import { Button, Flex, Table, Typography } from 'antd';
import { useCallback, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { type EventSummaryRow, getEventSummary } from '../../services/analytics';
import { useAdminMeta } from '../../session/useSession';
import { formatCount } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { ReadState } from './ReadState';
import { useRead } from './useRead';

const PAGE_SIZE = 50;

/**
 * 埋点管理 · 事件汇总 (`ANALYTICS:VIEW`): every event name of a UTC day range with how many times it
 * fired and by how many distinct accounts. The backend sends all names in one answer, so the
 * paging (50 a page) and the sorting happen here.
 */
export default function EventSummaryPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => lastNDaysUtc(7));
  // `asked` is a new object at every press of Query, so pressing it again reads again.
  const [asked, setAsked] = useState<DayRange>(draft);
  const fetcher = useCallback(() => getEventSummary(asked), [asked]);
  const { data, failure, loading, reload } = useRead(fetcher);

  const number = (n: number) => formatCount(n, intl.locale);
  const rows = data?.items ?? [];

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.analyticsLiveMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setAsked({ ...draft })}>
          {t('analytics.common.query')}
        </Button>
        <UtcNotice />
      </Flex>
      <ReadState failure={failure} loading={loading} onRetry={reload} />
      {data ? (
        <>
          <Typography.Text type="secondary">
            {t('analytics.summary.total', { count: rows.length })}
          </Typography.Text>
          <Table<EventSummaryRow>
            size="small"
            rowKey="eventName"
            dataSource={rows}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{ emptyText: t('analytics.summary.empty') }}
            columns={[
              {
                title: t('analytics.common.eventName'),
                dataIndex: 'eventName',
                sorter: (a, b) =>
                  a.eventName < b.eventName ? -1 : a.eventName > b.eventName ? 1 : 0,
                render: (value: string) => <EllipsisPopoverText text={value} width={320} />,
              },
              {
                title: t('analytics.summary.pv'),
                dataIndex: 'pv',
                align: 'right',
                defaultSortOrder: 'descend',
                sorter: (a, b) => a.pv - b.pv,
                render: (value: number) => number(value),
              },
              {
                title: t('analytics.summary.uv'),
                dataIndex: 'uv',
                align: 'right',
                sorter: (a, b) => a.uv - b.uv,
                render: (value: number) => number(value),
              },
            ]}
          />
        </>
      ) : null}
      <Typography.Text type="secondary">{t('analytics.summary.tip')}</Typography.Text>
    </Flex>
  );
}
