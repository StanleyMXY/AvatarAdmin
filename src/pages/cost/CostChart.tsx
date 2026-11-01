import { Column } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { useMemo } from 'react';
import { toDecimalString } from '../../services/cost';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import type { ChartPoint } from './costRows';
import { legendLabels } from './labels';

/**
 * What the tooltip shows for one bar piece: the whole name of the model (the legend cuts a long name
 * and numbers two that start alike, which does not say which is which) and the exact amount.
 */
export const costTooltipItem = (d: { model: string; text: string }) => ({
  name: d.model,
  value: d.text,
});

/** `2026-10-24` as `10-24`. */
const shortDay = (day: string) => String(day).slice(5);

/**
 * The daily cost of one currency, stacked by model. The sums were made with decimals; the number
 * handed to the drawing is only for the height of a bar, and the tooltip shows the exact text.
 */
export function CostChart({ currency, points }: { currency: string; points: ChartPoint[] }) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const data = useMemo(() => {
    const labels = legendLabels([...new Set(points.map((p) => p.model))]);
    return points.map((p) => ({
      statDate: p.statDate,
      label: labels.get(p.model) ?? p.model,
      model: p.model,
      value: p.value,
      text: p.text,
    }));
  }, [points]);
  const axisText = { labelFill: theme.textColor, titleFill: theme.textColor };
  return (
    <Column
      data={data}
      xField="statDate"
      yField="value"
      colorField="label"
      stack
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette } }}
      axis={{
        x: {
          ...axisText,
          title: intl.formatMessage({ id: 'cost.common.date' }),
          labelFormatter: shortDay,
          labelAutoHide: true,
        },
        y: {
          ...axisText,
          gridStroke: theme.gridColor,
          title: intl.formatMessage({ id: 'cost.report.chart.y' }, { currency }),
          labelFormatter: (value: number) => toDecimalString(value) ?? String(value),
        },
      }}
      tooltip={{
        items: [costTooltipItem],
      }}
      height={300}
    />
  );
}
