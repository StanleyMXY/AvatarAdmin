import { useIntl } from '@umijs/max';
import { Card, Statistic, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { FALL_COLOR, RISE_COLOR } from '../../theme/tokens';
import { DASH, formatCount, formatPercent } from '../../utils/ratio';

type Props = {
  title: ReactNode;
  value: number | null;
  /** The value of the period to compare with; null or 0 means there is nothing to compare. */
  previous?: number | null;
  /** What the comparison is against, for example "vs the day before". */
  previousLabel: string;
  /**
   * `count`: a number. `percent`: a ratio (0.25 is 25%) with a relative change. `percentPoint`: a
   * ratio whose change is the difference in percentage points.
   */
  unit?: 'count' | 'percent' | 'percentPoint';
  tip?: ReactNode;
};

/** A number with its change against the previous period: green up, red down, a dash when it cannot be told. */
export function StatCard({ title, value, previous, previousLabel, unit = 'count', tip }: Props) {
  const intl = useIntl();
  const locale = intl.locale;
  const shown = unit === 'count' ? formatCount(value, locale) : formatPercent(value, locale);

  let change: { text: string; color?: string } = { text: DASH };
  const comparable =
    value !== null &&
    Number.isFinite(value) &&
    previous !== null &&
    previous !== undefined &&
    Number.isFinite(previous) &&
    previous !== 0;
  if (comparable) {
    const delta =
      unit === 'percentPoint' ? (value - previous) * 100 : ((value - previous) / previous) * 100;
    const rounded = Math.round(delta * 10) / 10;
    const number = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(rounded);
    const unitText =
      unit === 'percentPoint'
        ? ` ${intl.formatMessage({ id: 'stat.common.unit.percentPoint' })}`
        : '%';
    change = {
      text: `${number}${unitText}`,
      color: rounded > 0 ? RISE_COLOR : rounded < 0 ? FALL_COLOR : undefined,
    };
  }

  return (
    <Card size="small">
      <Statistic
        title={tip ? <Tooltip title={tip}>{title}</Tooltip> : title}
        value={shown}
        formatter={(v) => <span data-testid="stat-value">{v}</span>}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {previousLabel}{' '}
        <span data-testid="stat-change" style={change.color ? { color: change.color } : undefined}>
          {change.text}
        </span>
      </Typography.Text>
    </Card>
  );
}
