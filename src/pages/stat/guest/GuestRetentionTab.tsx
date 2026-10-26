import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Select } from 'antd';
import { useCallback, useState } from 'react';
import { ExportButton } from '../../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../../components/stat/DateRangeUtc';
import {
  PlatformChannelFilter,
  type PlatformChannelValue,
} from '../../../components/stat/PlatformChannelFilter';
import { RetentionTrendChart } from '../../../components/stat/RetentionTrendChart';
import { getGuestRetention } from '../../../services/stats/reports';
import { RETENTION_DAYS } from '../../../services/stats/types';
import { useAdminMeta } from '../../../session/useSession';
import { lastNDaysUtc } from '../../../utils/utcDay';
import { DeviceCohortMatrix } from './DeviceCohortMatrix';
import { GuestLandBar } from './GuestLandBar';
import { ReportState } from './ReportState';
import { useReport } from './useReport';

type Filter = { range: DayRange } & PlatformChannelValue;

const DEFAULT_DAYS = [1, 7, 30];
const initialFilter = (): Filter => ({ range: lastNDaysUtc(30), platform: 'ALL', channel: 'ALL' });

/**
 * 游客留存: the share of the devices that first appeared on a day that were seen again on day N
 * (any client event). The base is devices. The note says what the cohort is.
 */
export function GuestRetentionTab() {
  const intl = useIntl();
  const meta = useAdminMeta();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(draft);
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS);
  const fetcher = useCallback(
    () =>
      getGuestRetention({
        from: applied.range.from,
        to: applied.range.to,
        platform: applied.platform,
        channel: applied.channel,
      }),
    [applied],
  );
  const { data, failure, reload } = useReport(fetcher);
  const chosen = [...days].sort((a, b) => a - b);

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <PlatformChannelFilter
          value={{ platform: draft.platform, channel: draft.channel }}
          onChange={(value) => setDraft((d) => ({ ...d, ...value }))}
        />
        <Select<number[]>
          mode="multiple"
          virtual={false}
          style={{ minWidth: 220 }}
          aria-label={t('stat.guest.retention.days')}
          value={days}
          options={RETENTION_DAYS.map((n) => ({
            value: n,
            label: t('stat.common.dayN', { n }),
            title: t('stat.common.dayN', { n }),
          }))}
          onChange={setDays}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="guest-retention"
          viewCode="STATS:VIEW"
          params={{
            from: applied.range.from,
            to: applied.range.to,
            platform: applied.platform,
            channel: applied.channel,
          }}
        />
      </Flex>
      <GuestLandBar onLanded={reload} />
      <Alert type="info" showIcon title={t('stat.guest.retention.note')} />
      <ReportState failure={failure} loading={data === null} onRetry={reload} />
      {data ? (
        <>
          <RetentionTrendChart rows={data.items} days={chosen} />
          <DeviceCohortMatrix
            rows={data.items}
            days={chosen}
            idPrefix="retention"
            dateLabel={t('stat.guest.retention.cohortDate')}
            sizeLabel={t('stat.guest.retention.cohortSize')}
          />
        </>
      ) : null}
    </Flex>
  );
}
