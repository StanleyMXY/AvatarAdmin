import { Funnel } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Card, Empty, Table } from 'antd';
import { TrendChart } from '../../components/stat/TrendChart';
import type { ShareFunnelRow } from '../../services/invite';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { plainText } from '../../utils/plainText';
import { formatCount, formatPercent } from '../../utils/ratio';
import { count, rateOf, sumCounts } from './numbers';

type Props = { rows: ShareFunnelRow[]; from: string; to: string };

const STEPS = [
  { field: 'sharePv', step: 'invite.share.step.share' },
  { field: 'linkClickPv', step: 'invite.share.step.linkClick' },
  { field: 'downloadClickPv', step: 'invite.share.step.downloadClick' },
  { field: 'registered', step: 'invite.share.step.registered' },
] as const;

/**
 * The second tab: the funnel share, link click, download click, sign-up (each ratio is the step
 * divided by the step before it), the four steps as four lines of one chart, and one row per day
 * with the unique visitors of that day. Nothing is added over days except the page views.
 */
export function ShareFunnelTab({ rows, from, to }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const sums = STEPS.map(({ field }) => sumCounts(rows.map((row) => row[field])));
  const funnel = STEPS.map(({ step }, index) => {
    const stage = t(step);
    const shown = formatCount(sums[index], intl.locale);
    const ratio = formatPercent(
      index === 0 ? null : rateOf(sums[index], sums[index - 1]),
      intl.locale,
    );
    return {
      stage,
      value: sums[index] ?? 0,
      caption: index === 0 ? `${stage}  ${shown}` : `${stage}  ${shown}  (${ratio})`,
      field: STEPS[index].field,
      line:
        index === 0
          ? intl.formatMessage({ id: 'invite.share.funnelStepFirst' }, { stage, value: shown })
          : intl.formatMessage(
              { id: 'invite.share.funnelStepRatio' },
              { stage, value: shown, ratio },
            ),
    };
  });
  const cell = (value: unknown) => formatCount(count(value), intl.locale);

  return (
    <>
      <Card size="small" title={t('invite.share.funnelTitle')} data-testid="invite-share-funnel">
        {sums.every((sum) => sum === null) ? (
          <Empty description={t('invite.share.noRows')} />
        ) : (
          <Funnel
            data={funnel}
            xField="stage"
            yField="value"
            theme={theme.g2Theme}
            scale={{ color: { range: theme.palette } }}
            legend={false}
            label={{
              text: (d: { caption: string }) => d.caption,
              style: { fill: theme.textColor },
            }}
            height={220}
          />
        )}
        {sums.every((sum) => sum === null) ? null : (
          // The labels inside the blocks of the chart are crowded where a step is far smaller than
          // the one before it; the same numbers and ratios are written out here as plain text.
          <ul
            data-testid="invite-share-funnel-steps"
            style={{ margin: '8px 0 0', paddingInlineStart: 20 }}
          >
            {funnel.map((one) => (
              <li key={one.field}>{one.line}</li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        size="small"
        title={t('invite.share.linesTitle')}
        data-testid="invite-share-lines"
        style={{ marginTop: 16 }}
      >
        <TrendChart
          wholeNumbers
          rows={rows.map((row) => ({
            statDate: row.statDate,
            sharePv: count(row.sharePv),
            linkClickPv: count(row.linkClickPv),
            downloadClickPv: count(row.downloadClickPv),
            registered: count(row.registered),
          }))}
          xField="statDate"
          from={from}
          to={to}
          series={[
            { field: 'sharePv', label: t('invite.share.sharePv') },
            { field: 'linkClickPv', label: t('invite.share.linkClickPv') },
            { field: 'downloadClickPv', label: t('invite.share.downloadClickPv') },
            { field: 'registered', label: t('invite.share.registered') },
          ]}
        />
      </Card>
      <Card size="small" title={t('invite.share.detail')} style={{ marginTop: 16 }}>
        <div data-testid="invite-share-detail">
          <Table
            size="small"
            rowKey="statDate"
            dataSource={rows}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('invite.share.col.date'),
                dataIndex: 'statDate',
                render: (value: unknown) => plainText(value),
              },
              ...(
                [
                  ['sharePv', 'invite.share.col.sharePv'],
                  ['shareUv', 'invite.share.col.shareUv'],
                  ['linkClickPv', 'invite.share.col.linkClickPv'],
                  ['downloadClickPv', 'invite.share.col.downloadClickPv'],
                  ['registered', 'invite.share.col.registered'],
                ] as const
              ).map(([field, title]) => ({
                title: t(title),
                dataIndex: field,
                align: 'right' as const,
                render: cell,
              })),
            ]}
          />
        </div>
      </Card>
    </>
  );
}
