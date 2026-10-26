import { useIntl } from '@umijs/max';
import { Button, Flex, Select, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import {
  type AttributionRecord,
  getRecords,
  MATCH_TYPES,
  type MatchType,
  RECORD_SOURCES,
  type RecordSource,
} from '../../services/campaign';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { lastNDaysUtc, utcDayRangeToInstants } from '../../utils/utcDay';
import { AccountLink } from './AccountLink';
import { moneyText, numberOf } from './figures';
import { HeaderTip } from './HeaderTip';
import { PagedTable } from './PagedTable';
import { codeText, instantText, orDash } from './texts';
import type { CampaignList } from './useCampaigns';
import { useServerPage } from './useServerPage';

type Filter = {
  range: DayRange;
  source: RecordSource | undefined;
  matchType: MatchType | undefined;
};

const initialFilter = (): Filter => ({
  range: lastNDaysUtc(7),
  source: undefined,
  matchType: undefined,
});

const ALL = '';

/**
 * 安装与注册 (`ATTRIBUTION:VIEW`): the records of both sources, newest event first. The device and
 * the platform's own identifiers are not in the answer and not on the page. The match type says how
 * sure the match is; the fingerprint is marked as the least reliable.
 */
export function RecordsTab({ campaigns }: { campaigns: CampaignList }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(initialFilter);

  const { from, to } = utcDayRangeToInstants(applied.range.from, applied.range.to);
  const state = useServerPage(getRecords, {
    source: applied.source,
    matchType: applied.matchType,
    from,
    to,
  });

  const text = (field: keyof AttributionRecord, width = 140) => ({
    dataIndex: field,
    render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={width} />,
  });
  const when = (field: keyof AttributionRecord) => ({
    dataIndex: field,
    render: (value: unknown) => instantText(intl.locale, value),
  });

  const columns: ColumnsType<AttributionRecord> = [
    {
      title: t('campaign.records.col.id'),
      dataIndex: 'id',
      render: (value: unknown) => <span style={{ overflowWrap: 'anywhere' }}>{orDash(value)}</span>,
    },
    {
      title: t('campaign.records.col.source'),
      dataIndex: 'source',
      render: (value: unknown) => {
        const label = codeText(intl, 'campaign.records.source', value);
        return label === '' ? DASH : <Tag style={{ marginInlineEnd: 0 }}>{label}</Tag>;
      },
    },
    { title: t('campaign.records.col.eventName'), ...text('eventName', 180) },
    { title: t('campaign.records.col.eventTime'), ...when('eventTime') },
    { title: t('campaign.records.col.conversionType'), ...text('conversionType') },
    { title: t('campaign.records.col.campaignType'), ...text('campaignType') },
    { title: t('campaign.records.col.mediaSource'), ...text('mediaSource') },
    { title: t('campaign.records.col.campaign'), ...text('campaign', 180) },
    { title: t('campaign.records.col.adset'), ...text('adset', 180) },
    { title: t('campaign.records.col.ad'), ...text('ad', 180) },
    { title: t('campaign.records.col.installTime'), ...when('installTime') },
    {
      title: t('campaign.records.col.retargeting'),
      dataIndex: 'isRetargeting',
      render: (value: unknown) =>
        value === true
          ? t('campaign.records.yes')
          : value === false
            ? t('campaign.records.no')
            : DASH,
    },
    { title: t('campaign.records.col.platform'), ...text('platform', 100) },
    { title: t('campaign.records.col.country'), ...text('countryCode', 80) },
    { title: t('campaign.records.col.appVersion'), ...text('appVersion', 100) },
    {
      title: t('campaign.records.col.cost'),
      key: 'cost',
      align: 'end',
      render: (_, row) =>
        numberOf(row.cost) === null
          ? DASH
          : `${moneyText(row.cost, intl.locale)} ${plainText(row.costCurrency)}`.trim(),
    },
    { title: t('campaign.records.col.costModel'), ...text('costModel', 100) },
    {
      title: t('campaign.records.col.costSelected'),
      dataIndex: 'costInSelectedCurrency',
      align: 'end',
      render: (value: unknown) => moneyText(value, intl.locale),
    },
    {
      title: t('campaign.records.col.accountId'),
      dataIndex: 'accountId',
      render: (value: unknown) => <AccountLink accountId={value} />,
    },
    { title: t('campaign.records.col.registeredAt'), ...when('registeredAt') },
    {
      title: (
        <HeaderTip id="campaign.records.matchType" label={t('campaign.records.col.matchType')} />
      ),
      dataIndex: 'matchType',
      render: (value: unknown) => {
        const label = codeText(intl, 'campaign.records.matchType', value);
        if (label === '') return DASH;
        return value === 'FINGERPRINT' ? (
          <Flex gap={4} wrap align="center">
            <span>{label}</span>
            <Tag color="warning" style={{ marginInlineEnd: 0 }}>
              {t('campaign.records.fingerprintLow')}
            </Tag>
          </Flex>
        ) : (
          label
        );
      },
    },
    {
      title: t('campaign.records.col.attributionCampaign'),
      dataIndex: 'attributionCampaignId',
      render: (value: unknown) => (
        <EllipsisPopoverText
          text={plainText(campaigns.byId(value)?.name) || plainText(value)}
          width={220}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('campaign.records.time')}</Typography.Text>
          <DateRangeUtc
            value={draft.range}
            onChange={(range) => setDraft((d) => ({ ...d, range }))}
          />
        </Flex>
        <Flex gap={8} align="center">
          <Typography.Text>{t('campaign.records.source')}</Typography.Text>
          <Select
            style={{ minWidth: 240 }}
            aria-label={t('campaign.records.source')}
            value={draft.source ?? ALL}
            options={[
              { value: ALL, label: t('campaign.records.source.all') },
              ...RECORD_SOURCES.map((s) => ({
                value: s,
                label: t(`campaign.records.source.${s}`),
              })),
            ]}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                source: value === ALL ? undefined : (value as RecordSource),
              }))
            }
          />
        </Flex>
        <Flex gap={8} align="center">
          <Typography.Text>{t('campaign.records.matchType')}</Typography.Text>
          <Select
            style={{ minWidth: 260 }}
            aria-label={t('campaign.records.matchType')}
            value={draft.matchType ?? ALL}
            options={[
              { value: ALL, label: t('campaign.records.matchType.all') },
              ...MATCH_TYPES.map((m) => ({
                value: m,
                label: t(`campaign.records.matchType.${m}`),
              })),
            ]}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                matchType: value === ALL ? undefined : (value as MatchType),
              }))
            }
          />
        </Flex>
        <Button
          type="primary"
          onClick={() => {
            setApplied({ ...draft });
            state.search();
          }}
        >
          {t('stat.common.query')}
        </Button>
      </Flex>
      <PagedTable<AttributionRecord>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('campaign.records.empty')}
      />
    </Flex>
  );
}
