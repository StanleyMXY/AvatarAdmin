import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Card, Flex, Statistic, Tooltip } from 'antd';
import type { AdMetrics } from '../../services/ads';
import { avgSecondsText, countCell, percentText, ratioOf, undeterminedOf } from './reportFigures';

type Totals = Partial<AdMetrics>;

type CardSpec = { name: string; value: (totals: Totals, locale: string, unit: string) => string };

const sum = (a: unknown, b: unknown): number | null =>
  typeof a === 'number' && typeof b === 'number' ? a + b : null;

const count =
  (field: keyof AdMetrics): CardSpec['value'] =>
  (totals, locale) =>
    countCell(totals[field], locale);

/** The 14 cards of the spec, in its order; a ratio is shown only when its denominator is above 0. */
const CARDS: CardSpec[] = [
  { name: 'impressions', value: count('impressions') },
  { name: 'guestImpressions', value: count('guestImpressions') },
  { name: 'starts', value: count('starts') },
  { name: 'clicks', value: count('clicks') },
  { name: 'completions', value: count('completions') },
  { name: 'skips', value: count('skips') },
  { name: 'viewableImpressions', value: count('viewableImpressions') },
  { name: 'nonViewableImpressions', value: count('nonViewableImpressions') },
  {
    name: 'undeterminedImpressions',
    value: (totals, locale) => countCell(undeterminedOf(totals.undeterminedImpressions), locale),
  },
  {
    name: 'ctr',
    value: (totals, locale) =>
      percentText(ratioOf(totals.ctr, totals.clicks, totals.impressions), locale),
  },
  {
    name: 'completionRate',
    value: (totals, locale) =>
      percentText(ratioOf(totals.completionRate, totals.completions, totals.starts), locale),
  },
  {
    name: 'viewableRate',
    value: (totals, locale) =>
      percentText(
        ratioOf(
          totals.viewableRate,
          totals.viewableImpressions,
          sum(totals.viewableImpressions, totals.nonViewableImpressions),
        ),
        locale,
      ),
  },
  {
    name: 'measurableRate',
    value: (totals, locale) =>
      percentText(
        ratioOf(
          totals.measurableRate,
          sum(totals.viewableImpressions, totals.nonViewableImpressions),
          totals.impressions,
        ),
        locale,
      ),
  },
  {
    name: 'avgWatchSeconds',
    value: (totals, locale, unit) =>
      avgSecondsText(
        ratioOf(totals.avgWatchSeconds, totals.totalWatchSeconds, totals.starts),
        locale,
        unit,
      ),
  },
];

/**
 * The cards of the report: the numbers of the whole range, each with an icon that says in words how
 * it is worked out. The guest impressions are part of the impressions. There is no count of
 * distinct users: it cannot be added across days or rows (contract 22.8).
 */
export function ReportCards({ totals }: { totals: Totals }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Flex gap={12} wrap>
      {CARDS.map(({ name, value }) => (
        <Card
          key={name}
          size="small"
          data-testid={`ads-card-${name}`}
          style={{ flex: '1 1 190px', minWidth: 0 }}
        >
          <Statistic
            title={
              <span>
                {t(`ads.report.card.${name}`)}{' '}
                <Tooltip title={t(`ads.report.tip.${name}`)}>
                  <QuestionCircleOutlined />
                </Tooltip>
              </span>
            }
            value=" "
            formatter={() => (
              <span data-testid="ads-card-value" dir="ltr">
                {value(totals, intl.locale, t('ads.report.seconds'))}
              </span>
            )}
          />
        </Card>
      ))}
    </Flex>
  );
}
