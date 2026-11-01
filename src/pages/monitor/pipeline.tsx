import { Line } from '@ant-design/plots';
import { Link, useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Card, Empty, Flex, Segmented, Select, Spin, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFailure } from '../../hooks/useFailure';
import { getPipeline, type PipelinePoint } from '../../services/monitor';
import { axisTextStyle, getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';

const HOUR_MS = 3600_000;

/** The time ranges on offer, in hours; the longest is what the backend allows (`monitor.max_range_days`, 7). */
const RANGES = { '1h': 1, '6h': 6, '24h': 24, '3d': 72, '7d': 168 } as const;
type RangeKey = keyof typeof RANGES;

type Chart = {
  key: 'gpu' | 'errorCount' | 'errorRate';
  titleId: string;
  /** The figure of a point, or null when the sender did not report it (the point is then left out). */
  pick: (point: PipelinePoint) => number | null;
};

const finite = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const percent = (value: number | null | undefined): number | null => {
  const v = finite(value);
  return v === null ? null : Math.round(v * 10000) / 100;
};

const CHARTS: Chart[] = [
  { key: 'gpu', titleId: 'monitor.pipeline.gpu', pick: (p) => percent(p.gpuUtilization) },
  { key: 'errorCount', titleId: 'monitor.pipeline.errorCount', pick: (p) => finite(p.errorCount) },
  { key: 'errorRate', titleId: 'monitor.pipeline.errorRate', pick: (p) => percent(p.errorRate) },
];

type Series = { at: number; source: string; value: number };

function seriesOf(points: PipelinePoint[], pick: Chart['pick']): Series[] {
  const rows: Series[] = [];
  for (const point of points) {
    const value = pick(point);
    const at = Date.parse(point.effectiveAt ?? point.reportedAt);
    // a figure that was not reported is not drawn at all: neither as zero nor as a gap marker
    if (value === null || Number.isNaN(at)) continue;
    rows.push({ at, source: point.source, value });
  }
  return rows;
}

/** 系统监控 · 管线监控: GPU utilization, error count and error rate over time, by source. No cost here. */
export default function PipelinePage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const [range, setRange] = useState<RangeKey>('24h');
  const [source, setSource] = useState<string | undefined>(undefined);
  const [known, setKnown] = useState<string[]>([]);
  const [points, setPoints] = useState<PipelinePoint[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const { text: failure, fail, clear } = useFailure();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // `reload` makes this run again when "Refresh" is pressed
    void reload;
    let live = true;
    const to = new Date();
    const from = new Date(to.getTime() - RANGES[range] * HOUR_MS);
    setPoints(null);
    getPipeline({ from: from.toISOString(), to: to.toISOString(), source })
      .then((answer) => {
        if (!live) return;
        setPoints(answer.items);
        setTruncated(answer.truncated === true);
        clear();
        setKnown((before) =>
          [...new Set([...before, ...answer.items.map((p) => p.source)])].sort(),
        );
      })
      .catch((error) => {
        if (!live) return;
        fail(error);
        setPoints([]);
      });
    return () => {
      live = false;
    };
  }, [range, source, reload, fail, clear]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(intl.locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    [intl.locale],
  );

  const sources = useMemo(
    () => [...new Set([...known, ...(source ? [source] : [])])],
    [known, source],
  );

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Segmented
            aria-label={t('monitor.pipeline.range')}
            value={range}
            onChange={(value) => setRange(value as RangeKey)}
            options={(Object.keys(RANGES) as RangeKey[]).map((key) => ({
              value: key,
              label: t(`monitor.pipeline.range.${key}`),
            }))}
          />
        </div>
        <Select
          allowClear
          aria-label={t('monitor.pipeline.source')}
          placeholder={t('monitor.pipeline.allSources')}
          style={{ minWidth: 200 }}
          value={source}
          onChange={(value) => setSource(value ?? undefined)}
          options={sources.map((s) => ({ value: s, label: s }))}
        />
        <Button onClick={refresh}>{t('monitor.pipeline.refresh')}</Button>
        <Typography.Text type="secondary">{t('monitor.pipeline.timeZone')}</Typography.Text>
      </Flex>

      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={refresh}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {truncated ? <Alert type="info" showIcon title={t('monitor.pipeline.truncated')} /> : null}

      {points === null ? (
        <Spin />
      ) : failure ? null : (
        CHARTS.map((chart) => {
          const data = seriesOf(points, chart.pick);
          return (
            <Card key={chart.key} size="small" title={t(chart.titleId)}>
              {data.length === 0 ? (
                <Empty description={t('monitor.pipeline.empty')} />
              ) : (
                <Line
                  data={data}
                  xField="at"
                  yField="value"
                  colorField="source"
                  theme={theme.g2Theme}
                  scale={{ x: { type: 'time' }, color: { range: theme.palette } }}
                  axis={{
                    x: {
                      ...axisTextStyle(theme),
                      labelFormatter: (value: number | Date) => time.format(value),
                    },
                    y: { ...axisTextStyle(theme), gridStroke: theme.gridColor },
                  }}
                  height={240}
                />
              )}
            </Card>
          );
        })
      )}

      {access.canAccess('COST:VIEW') ? (
        <Link to="/cost/report">{t('monitor.pipeline.costLink')}</Link>
      ) : (
        <Typography.Text type="secondary">{t('monitor.pipeline.costText')}</Typography.Text>
      )}
    </Flex>
  );
}
