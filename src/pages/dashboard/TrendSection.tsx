import { DualAxes } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Button, Card, DatePicker, Flex, Radio, Select, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { describeFailure } from '../../session/describe';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { pickedDay, todayUtc } from '../../utils/utcDay';
import type { DailyData, RetentionData } from './dashboardSources';
import { buildTrendChart } from './trendChart';
import {
  DEFAULT_METRICS,
  RANGE_PRESETS,
  type RangePreset,
  rangeOfPreset,
  TREND_METRICS,
  type TrendMetric,
  trendPoints,
} from './trendData';
import type { Source } from './useSource';

type Props = { daily: Source<DailyData>; retention: Source<RetentionData> };

const asPickerDate = (day: string) => dayjs(`${day}T00:00:00`);

/**
 * The trend chart (spec 5.1): five range presets, the metrics to draw (at least one), and for each
 * metric a dashed line of the same days one week earlier. It reads the 90 days the cards already
 * loaded, so changing the range or the metrics asks the backend for nothing.
 */
export function TrendSection({ daily, retention }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [mode] = useThemeMode();
  const [preset, setPreset] = useState<RangePreset>('last7');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [metrics, setMetrics] = useState<TrendMetric[]>(DEFAULT_METRICS);

  const loaded = daily.data ?? retention.data;
  const today = loaded?.today ?? todayUtc();
  const window = loaded?.window ?? { from: today, to: today };
  const range =
    preset === 'custom' ? (custom ?? { from: today, to: today }) : rangeOfPreset(preset, today);

  const needsDaily = metrics.some((m) => m !== 'd1');
  const needsRetention = metrics.includes('d1');
  const needed = [needsDaily ? daily : null, needsRetention ? retention : null].filter(
    (source): source is Source<DailyData> | Source<RetentionData> => source !== null,
  );
  const failed = needed.filter((source) => source.status === 'failed');
  const ready = needed.every((source) => source.status === 'ready');

  const theme = getChartTheme(mode);
  const buildChart = () => {
    if (!ready || range === null) return null;
    const points = Object.fromEntries(
      metrics.map((metric) => [
        metric,
        trendPoints({
          metric,
          range,
          daily: daily.data?.rows ?? [],
          retention: retention.data?.rows ?? [],
          window,
          today,
        }),
      ]),
    ) as Partial<Record<TrendMetric, ReturnType<typeof trendPoints>>>;
    const label = (metric: TrendMetric) => intl.formatMessage({ id: `dashboard.metric.${metric}` });
    return buildTrendChart({
      metrics,
      points,
      metricLabel: label,
      lastWeekLabel: (metric) =>
        intl.formatMessage({ id: 'dashboard.trend.lastWeek' }, { metric: label(metric) }),
      unitLabel: (metric) =>
        intl.formatMessage({
          id:
            metric === 'd1'
              ? 'dashboard.axis.percent'
              : metric === 'callMinutes'
                ? 'dashboard.axis.minutes'
                : 'dashboard.axis.accounts',
        }),
      theme,
      singleDay: range.from === range.to,
    });
  };
  const chart = buildChart();

  const choosePreset = (next: RangePreset) => {
    if (next === 'custom' && custom === null && range !== null) setCustom(range);
    setPreset(next);
  };

  return (
    <Card size="small" data-testid="dashboard-trend" title={t('dashboard.trend.title')}>
      <Flex gap={12} wrap align="center" style={{ marginBottom: 12 }}>
        <Radio.Group
          optionType="button"
          value={preset}
          onChange={(event) => choosePreset(event.target.value as RangePreset)}
          options={RANGE_PRESETS.map((value) => ({
            value,
            label: t(`dashboard.range.${value}`),
          }))}
        />
        {preset === 'custom' && custom ? (
          <DatePicker.RangePicker
            allowClear={false}
            value={[asPickerDate(custom.from), asPickerDate(custom.to)]}
            disabledDate={(day) => {
              const picked = pickedDay(day);
              return picked < window.from || picked > window.to;
            }}
            onChange={(picked) => {
              if (picked?.[0] && picked[1]) {
                setCustom({ from: pickedDay(picked[0]), to: pickedDay(picked[1]) });
              }
            }}
          />
        ) : null}
        <Select
          mode="multiple"
          allowClear={false}
          style={{ minWidth: 260, maxWidth: 520 }}
          aria-label={t('dashboard.trend.metrics')}
          value={metrics}
          options={TREND_METRICS.map((value) => ({
            value,
            label: t(`dashboard.metric.${value}`),
            title: t(`dashboard.metric.${value}`),
          }))}
          onChange={(next: TrendMetric[]) => {
            // At least one metric stays: removing the last one changes nothing.
            if (next.length === 0) return;
            setMetrics(TREND_METRICS.filter((metric) => next.includes(metric)));
          }}
        />
      </Flex>
      {failed.length > 0 ? (
        <div data-testid="dashboard-error-trend">
          <Typography.Text type="danger">
            {t('dashboard.card.loadFailed', {
              message: describeFailure(intl, failed[0].error).text,
            })}
          </Typography.Text>{' '}
          <Button
            size="small"
            onClick={() => {
              for (const source of failed) source.reload();
            }}
          >
            {t('pages.common.retry')}
          </Button>
        </div>
      ) : chart ? (
        <DualAxes key={`${range?.from === range?.to}-${metrics.join()}`} {...chart} />
      ) : (
        <Skeleton active paragraph={{ rows: 6 }} />
      )}
    </Card>
  );
}
