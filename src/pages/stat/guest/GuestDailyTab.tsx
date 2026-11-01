import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Flex, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useState } from 'react';
import { ExportButton } from '../../../components/ExportButton';
import { ReadState } from '../../../components/ReadState';
import { DateRangeUtc, type DayRange } from '../../../components/stat/DateRangeUtc';
import { useLatestRead } from '../../../hooks/useLatestRead';
import { getGuestDaily } from '../../../services/stats/reports';
import type { GuestDailyRow } from '../../../services/stats/types';
import { useAdminMeta } from '../../../session/useSession';
import { DASH, formatCount, formatPercent } from '../../../utils/ratio';
import { defaultRange } from '../../analytics/defaultRange';
import { dailyConversionRate } from './conversion';
import { GuestLandBar } from './GuestLandBar';

/** A header with a hint icon; the tip is the language key `<id>.tip`. */
export function HeaderWithTip({ id, testId }: { id: string; testId: string }) {
  const intl = useIntl();
  return (
    <span>
      {intl.formatMessage({ id })}
      <Tooltip title={intl.formatMessage({ id: `${id}.tip` })}>
        <QuestionCircleOutlined
          data-testid={testId}
          aria-hidden={false}
          style={{ marginInlineStart: 4 }}
        />
      </Tooltip>
    </span>
  );
}

/**
 * 游客日报: new guest devices and converted devices per UTC day, and the rate of the day. The rate
 * is today's converted over today's new, which are not the same devices (said in the column hint).
 */
export function GuestDailyTab({
  landedTick,
  onLanded,
}: {
  landedTick: number;
  onLanded: () => void;
}) {
  const intl = useIntl();
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => defaultRange(meta.statsMaxRangeDays, 7));
  const [applied, setApplied] = useState<DayRange>(draft);
  const fetcher = useCallback(() => getGuestDaily(applied), [applied]);
  const { data, failure, reload } = useLatestRead(fetcher, { refreshKey: landedTick });

  const columns: ColumnsType<GuestDailyRow> = [
    {
      title: intl.formatMessage({ id: 'stat.guest.daily.date' }),
      dataIndex: 'statDate',
      fixed: 'left',
    },
    {
      title: <HeaderWithTip id="stat.guest.daily.new" testId="tip-new" />,
      dataIndex: 'guestDevicesNew',
      align: 'end',
      render: (n: number) => formatCount(n, intl.locale),
    },
    {
      title: <HeaderWithTip id="stat.guest.daily.converted" testId="tip-converted" />,
      dataIndex: 'guestDevicesConverted',
      align: 'end',
      render: (n: number) => formatCount(n, intl.locale),
    },
    {
      title: <HeaderWithTip id="stat.guest.daily.rate" testId="tip-rate" />,
      key: 'rate',
      align: 'end',
      render: (_: unknown, row) => {
        const rate = dailyConversionRate(row);
        return rate === null ? DASH : formatPercent(rate, intl.locale);
      },
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {intl.formatMessage({ id: 'stat.common.query' })}
        </Button>
        <ExportButton
          name="guest"
          viewCode="STATS:VIEW"
          params={{ from: applied.from, to: applied.to }}
        />
      </Flex>
      <GuestLandBar onLanded={onLanded} />
      <ReadState failure={failure} loading={data === null} onRetry={reload} />
      {data ? (
        <Table<GuestDailyRow>
          size="small"
          rowKey="statDate"
          columns={columns}
          dataSource={data.items}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      ) : null}
    </Flex>
  );
}
