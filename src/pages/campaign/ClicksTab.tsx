import { useAccess, useIntl } from '@umijs/max';
import { Button, Flex, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { StatusTag } from '../../components/StatusTag';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import {
  type AttributionClick,
  CLICK_STATUSES,
  type ClickStatus,
  getClicks,
} from '../../services/campaign';
import { useAdminMeta } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { lastNDaysUtc, utcDayRangeToInstants } from '../../utils/utcDay';
import { CampaignSelect } from './CampaignSelect';
import { PagedTable } from './PagedTable';
import { codeText, instantText, orDash } from './texts';
import type { CampaignList } from './useCampaigns';
import { useServerPage } from './useServerPage';

type Filter = {
  range: DayRange;
  campaignId: string | undefined;
  status: ClickStatus | undefined;
  keyword: string;
};

const initialFilter = (): Filter => ({
  range: lastNDaysUtc(7),
  campaignId: undefined,
  status: undefined,
  keyword: '',
});

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue',
  MATCHED: 'green',
  EXPIRED: 'default',
};

const ALL = '';

/**
 * 点击明细 (`ATTRIBUTION:VIEW`): the clicks of the own attribution, newest first. The address is
 * shown exactly as the backend gave it: masked, unless the administrator holds `ANALYTICS:IP_VIEW`.
 */
export function ClicksTab({ campaigns }: { campaigns: CampaignList }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const meta = useAdminMeta();
  const mayReadAddress = access.canAccess('ANALYTICS:IP_VIEW');
  const days = meta.attributionClickRetentionDays;

  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(initialFilter);

  const { from, to } = utcDayRangeToInstants(applied.range.from, applied.range.to);
  const state = useServerPage(getClicks, {
    from,
    to,
    campaignId: applied.campaignId,
    status: applied.status,
    keyword: trimSpec(applied.keyword),
  });
  const search = () => setApplied({ ...draft });

  const statusOptions = Object.fromEntries(
    CLICK_STATUSES.map((s) => [
      s,
      { label: t(`campaign.clicks.status.${s}`), color: STATUS_COLORS[s] },
    ]),
  );

  const columns: ColumnsType<AttributionClick> = [
    {
      title: t('campaign.clicks.col.id'),
      dataIndex: 'id',
      render: (value: unknown) => <span style={{ overflowWrap: 'anywhere' }}>{orDash(value)}</span>,
    },
    {
      title: t('campaign.clicks.col.clickedAt'),
      dataIndex: 'clickedAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
    {
      title: t('campaign.clicks.col.campaign'),
      key: 'campaign',
      render: (_, row) => (
        <EllipsisPopoverText
          text={
            plainText(row.campaignName) ||
            plainText(campaigns.byId(row.campaignId)?.name) ||
            plainText(row.campaignId)
          }
          width={220}
        />
      ),
    },
    {
      title: t('campaign.clicks.col.status'),
      dataIndex: 'status',
      render: (value: unknown) => <StatusTag status={plainText(value)} options={statusOptions} />,
    },
    {
      title: t('campaign.clicks.col.ip'),
      dataIndex: 'ip',
      // As the backend gave it: nothing here makes a mask longer or shorter.
      render: (value: unknown) => (
        <Typography.Text dir="ltr" style={{ overflowWrap: 'anywhere' }}>
          {orDash(value)}
        </Typography.Text>
      ),
    },
    {
      title: t('campaign.clicks.col.channel'),
      dataIndex: 'channel',
      render: (value: unknown) => orDash(codeText(intl, 'campaign.clicks.channel', value)),
    },
    {
      title: t('campaign.clicks.col.utmSource'),
      dataIndex: 'utmSource',
      render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={160} />,
    },
    {
      title: t('campaign.clicks.col.utmMedium'),
      dataIndex: 'utmMedium',
      render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={160} />,
    },
    {
      title: t('campaign.clicks.col.utmCampaign'),
      dataIndex: 'utmCampaign',
      render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={160} />,
    },
    {
      title: t('campaign.clicks.col.claimedAt'),
      dataIndex: 'claimedAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={4}>
        <Typography.Text type="secondary" data-testid="clicks-retention">
          {typeof days === 'number' && Number.isFinite(days) && days >= 1
            ? t('campaign.clicks.retention', { days })
            : t('campaign.clicks.retention.unknown')}
        </Typography.Text>
        <Typography.Text type="secondary">{t('campaign.clicks.nonAndroid')}</Typography.Text>
        <Typography.Text type="secondary">
          {mayReadAddress
            ? t('campaign.clicks.ip.full')
            : t('campaign.clicks.ip.masked', {
                permission: intl.messages['permission.ANALYTICS:IP_VIEW']
                  ? t('permission.ANALYTICS:IP_VIEW')
                  : 'ANALYTICS:IP_VIEW',
              })}
        </Typography.Text>
      </Flex>
      <Flex gap={12} wrap align="center">
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('campaign.clicks.time')}</Typography.Text>
          <DateRangeUtc
            value={draft.range}
            onChange={(range) => setDraft((d) => ({ ...d, range }))}
          />
        </Flex>
        <CampaignSelect
          list={campaigns}
          value={draft.campaignId}
          neededCode="ATTRIBUTION:MANAGE"
          onChange={(campaignId) => setDraft((d) => ({ ...d, campaignId }))}
        />
        <Flex gap={8} align="center">
          <Typography.Text>{t('campaign.clicks.status')}</Typography.Text>
          <Select
            style={{ minWidth: 140 }}
            aria-label={t('campaign.clicks.status')}
            value={draft.status ?? ALL}
            options={[
              { value: ALL, label: t('campaign.clicks.status.all') },
              ...CLICK_STATUSES.map((s) => ({ value: s, label: t(`campaign.clicks.status.${s}`) })),
            ]}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                status: value === ALL ? undefined : (value as ClickStatus),
              }))
            }
          />
        </Flex>
        <Flex gap={8} align="center">
          <Typography.Text>{t('campaign.clicks.keyword')}</Typography.Text>
          <Input
            style={{ width: 220 }}
            aria-label={t('campaign.clicks.keyword')}
            placeholder={t('campaign.clicks.keywordPlaceholder')}
            value={draft.keyword}
            onChange={(event) => setDraft((d) => ({ ...d, keyword: event.target.value }))}
            onPressEnter={search}
          />
        </Flex>
        <Button type="primary" onClick={search}>
          {t('stat.common.query')}
        </Button>
      </Flex>
      <PagedTable<AttributionClick>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('campaign.clicks.empty')}
      />
    </Flex>
  );
}
