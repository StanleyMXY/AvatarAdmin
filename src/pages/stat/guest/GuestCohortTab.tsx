import { Column, Pie } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Button, Flex, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { DateRangeUtc, type DayRange } from '../../../components/stat/DateRangeUtc';
import { getGuestCohort } from '../../../services/stats/reports';
import { GUEST_COHORT_DAYS } from '../../../services/stats/types';
import { useAdminMeta } from '../../../session/useSession';
import { getChartTheme } from '../../../theme/chartTheme';
import { useThemeMode } from '../../../theme/modes';
import { defaultRange } from '../../analytics/defaultRange';
import { buildConversionDistribution, buildConversionStack } from './conversion';
import { DeviceCohortMatrix } from './DeviceCohortMatrix';
import { GuestLandBar } from './GuestLandBar';
import { ReportState } from './ReportState';
import { useReport } from './useReport';

/**
 * 转化进度队列: for the devices that first appeared on a day, how many have converted by D0, D1 ...
 * D30 (cumulative), how long they took (ring), and the same per cohort day (stacked columns). A
 * column that is not due yet is a dash and is not counted anywhere.
 */
export function GuestCohortTab({
  landedTick,
  onLanded,
}: {
  landedTick: number;
  onLanded: () => void;
}) {
  const intl = useIntl();
  const meta = useAdminMeta();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const [draft, setDraft] = useState<DayRange>(() => defaultRange(meta.statsMaxRangeDays, 30));
  const [applied, setApplied] = useState<DayRange>(draft);
  const fetcher = useCallback(() => getGuestCohort(applied), [applied]);
  const { data, failure, reload } = useReport(fetcher, landedTick);
  const t = (id: string) => intl.formatMessage({ id });

  const ring = useMemo(
    () =>
      buildConversionDistribution(data?.items ?? []).map((b) => ({
        ...b,
        label: intl.formatMessage({ id: `stat.guest.bucket.${b.bucket}` }),
      })),
    [data, intl],
  );
  const stack = useMemo(
    () =>
      buildConversionStack(data?.items ?? []).map((d) => ({
        ...d,
        label: intl.formatMessage({ id: `stat.guest.segment.${d.segment}` }),
      })),
    [data, intl],
  );

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
      </Flex>

      <GuestLandBar onLanded={onLanded} />
      <ReportState failure={failure} loading={data === null} onRetry={reload} />
      {data ? (
        <>
          <Typography.Text type="secondary">{t('stat.guest.cohort.note')}</Typography.Text>
          <DeviceCohortMatrix
            rows={data.items}
            days={[...GUEST_COHORT_DAYS]}
            idPrefix="cohort"
            dateLabel={t('stat.guest.cohort.date')}
            sizeLabel={t('stat.guest.cohort.size')}
            withDelta
          />
          <Flex gap={24} wrap>
            <div style={{ flex: '1 1 360px', minWidth: 0 }}>
              <Typography.Text strong>{t('stat.guest.cohort.distribution')}</Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  {t('stat.guest.cohort.distribution.tip')}
                </Typography.Text>
              </div>
              <Pie
                data={ring}
                angleField="devices"
                colorField="label"
                innerRadius={0.6}
                theme={theme.g2Theme}
                scale={{ color: { range: theme.palette } }}
                height={300}
              />
            </div>
            <div style={{ flex: '2 1 480px', minWidth: 0 }}>
              <Typography.Text strong>{t('stat.guest.cohort.stack')}</Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  {t('stat.guest.cohort.stack.tip')}
                </Typography.Text>
              </div>
              <Column
                data={stack}
                xField="cohortDate"
                yField="devices"
                colorField="label"
                stack
                theme={theme.g2Theme}
                scale={{ color: { range: theme.palette } }}
                axis={{
                  x: { labelFill: theme.textColor },
                  y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
                }}
                height={300}
              />
            </div>
          </Flex>
        </>
      ) : null}
    </Flex>
  );
}
