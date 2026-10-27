import { useIntl } from '@umijs/max';
import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import type { ListReportName } from '../../services/ads';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { avgSecondsText, countCell, percentText, ratioOf, undeterminedOf } from './reportFigures';

export type DrillRow = Record<string, unknown> & { __key: string };

type Dimension = Exclude<ListReportName, 'nofill'>;

const sum = (a: unknown, b: unknown): number | null =>
  typeof a === 'number' && typeof b === 'number' ? a + b : null;

/**
 * The table under the four tabs (by placement, campaign, creative, country): one table whose first
 * column is the dimension and whose other columns are the metrics of the cards, the same for every
 * tab. A ratio is shown only where its denominator is above 0.
 */
export function DrillTable({
  dimension,
  rows,
  loading,
}: {
  dimension: Dimension;
  rows: DrillRow[];
  loading: boolean;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const locale = intl.locale;
  const count = (field: string) => (row: DrillRow) => countCell(row[field], locale);
  const percent = (value: number | null) => percentText(value, locale);

  const dimensionCell = (row: DrillRow) => {
    switch (dimension) {
      case 'by-placement':
        return (
          <>
            <EllipsisPopoverText text={plainText(row.placementName)} lines={2} width={200} />
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
              {plainText(row.slotKey)}
            </Typography.Text>
          </>
        );
      case 'by-campaign':
        return (
          <>
            <EllipsisPopoverText text={plainText(row.campaignName)} lines={2} width={220} />
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
              {plainText(row.campaignId) === '' ? '' : `#${plainText(row.campaignId)}`}
            </Typography.Text>
          </>
        );
      case 'by-creative': {
        const title = plainText(row.creativeTitle);
        return (
          <>
            {title === '' ? DASH : <EllipsisPopoverText text={title} lines={2} width={220} />}
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
              {plainText(row.creativeId) === '' ? '' : `#${plainText(row.creativeId)}`}
            </Typography.Text>
          </>
        );
      }
      case 'by-country': {
        const code = plainText(row.country);
        return code === '' ? t('ads.report.countryUnknown') : code;
      }
    }
  };

  const columns: ColumnsType<DrillRow> = [
    {
      key: 'dimension',
      title: t(`ads.report.dimension.${dimension}`),
      render: (_, row) => dimensionCell(row),
    },
    {
      key: 'impressions',
      title: t('ads.report.col.impressions'),
      align: 'end',
      render: (_, r) => count('impressions')(r),
    },
    {
      key: 'guest',
      title: t('ads.report.col.guestImpressions'),
      align: 'end',
      render: (_, r) => count('guestImpressions')(r),
    },
    {
      key: 'starts',
      title: t('ads.report.col.starts'),
      align: 'end',
      render: (_, r) => count('starts')(r),
    },
    {
      key: 'clicks',
      title: t('ads.report.col.clicks'),
      align: 'end',
      render: (_, r) => count('clicks')(r),
    },
    {
      key: 'ctr',
      title: t('ads.report.col.ctr'),
      align: 'end',
      render: (_, r) => percent(ratioOf(r.ctr, r.clicks, r.impressions)),
    },
    {
      key: 'completions',
      title: t('ads.report.col.completions'),
      align: 'end',
      render: (_, r) => count('completions')(r),
    },
    {
      key: 'completionRate',
      title: t('ads.report.col.completionRate'),
      align: 'end',
      render: (_, r) => percent(ratioOf(r.completionRate, r.completions, r.starts)),
    },
    {
      key: 'skips',
      title: t('ads.report.col.skips'),
      align: 'end',
      render: (_, r) => count('skips')(r),
    },
    {
      key: 'errors',
      title: t('ads.report.col.errors'),
      align: 'end',
      render: (_, r) => count('errors')(r),
    },
    {
      key: 'viewable',
      title: t('ads.report.col.viewableImpressions'),
      align: 'end',
      render: (_, r) => count('viewableImpressions')(r),
    },
    {
      key: 'nonViewable',
      title: t('ads.report.col.nonViewableImpressions'),
      align: 'end',
      render: (_, r) => count('nonViewableImpressions')(r),
    },
    {
      key: 'undetermined',
      title: t('ads.report.col.undeterminedImpressions'),
      align: 'end',
      render: (_, r) => countCell(undeterminedOf(r.undeterminedImpressions), locale),
    },
    {
      key: 'viewableRate',
      title: t('ads.report.col.viewableRate'),
      align: 'end',
      render: (_, r) =>
        percent(
          ratioOf(
            r.viewableRate,
            r.viewableImpressions,
            sum(r.viewableImpressions, r.nonViewableImpressions),
          ),
        ),
    },
    {
      key: 'measurableRate',
      title: t('ads.report.col.measurableRate'),
      align: 'end',
      render: (_, r) =>
        percent(
          ratioOf(
            r.measurableRate,
            sum(r.viewableImpressions, r.nonViewableImpressions),
            r.impressions,
          ),
        ),
    },
    {
      key: 'avgWatch',
      title: t('ads.report.col.avgWatchSeconds'),
      align: 'end',
      render: (_, r) =>
        avgSecondsText(
          ratioOf(r.avgWatchSeconds, r.totalWatchSeconds, r.starts),
          locale,
          t('ads.report.seconds'),
        ),
    },
  ];

  return (
    <Table<DrillRow>
      size="small"
      rowKey="__key"
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: t('ads.report.empty') }}
    />
  );
}
