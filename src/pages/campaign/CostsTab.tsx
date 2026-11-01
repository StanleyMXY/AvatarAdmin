import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedTable } from '../../components/PagedTable';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { type Kept, useKeptState } from '../../hooks/useKeptState';
import { useServerPage } from '../../hooks/useServerPage';
import {
  type AttributionCost,
  type CostSettings,
  deleteCost,
  listCosts,
} from '../../services/campaign';
import { describeFailure } from '../../session/describe';
import { clipCodePoints } from '../../utils/codePoints';
import { instantText, orDash } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { lastNDaysUtc } from '../../utils/utcDay';
import { BatchModal } from './BatchModal';
import { CampaignSelect } from './CampaignSelect';
import { CostModal } from './CostModal';
import { moneyText } from './figures';
import type { CampaignList } from './useCampaigns';

type Props = {
  campaigns: CampaignList;
  /** What `GET /config` said, or null while it is being read or when it could not be read. */
  settings: CostSettings | null;
  /** What the filters held when the tab was closed (the tab is drawn again each time it is opened). */
  kept: Kept;
};

type Filter = { campaignId: string | undefined; range: DayRange };
const initialFilter = (): Filter => ({ campaignId: undefined, range: lastNDaysUtc(30) });

/**
 * 投放成本: the costs of the campaigns, one for each campaign and day, in one currency. Filter by
 * campaign and days; enter a cost, change one, delete one (asked in the row), import many.
 */
export function CostsTab({ campaigns, settings, kept }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('ATTRIBUTION:MANAGE');
  const currency = settings?.currency ?? null;

  const [draft, setDraft] = useKeptState<Filter>(kept, 'costs.draft', initialFilter);
  const [applied, setApplied] = useKeptState<Filter>(kept, 'costs.applied', initialFilter);
  const [editing, setEditing] = useState<AttributionCost | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const state = useServerPage(listCosts, {
    campaignId: applied.campaignId,
    from: applied.range.from,
    to: applied.range.to,
  });

  const nameOf = (row: AttributionCost) =>
    plainText(campaigns.byId(row.campaignId)?.name) || plainText(row.campaignId);

  const remove = async (row: AttributionCost) => {
    try {
      await deleteCost(row.id);
      message.success(t('campaign.costs.deleted'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    state.reload();
  };

  const columns: ColumnsType<AttributionCost> = [
    {
      title: t('campaign.costs.col.name'),
      key: 'name',
      render: (_, row) => <EllipsisPopoverText text={nameOf(row)} width={220} />,
    },
    {
      title: t('campaign.costs.col.date'),
      dataIndex: 'statDate',
      render: (value: unknown) => orDash(value),
    },
    {
      title: t('campaign.costs.col.amount'),
      dataIndex: 'amount',
      align: 'end',
      render: (value: unknown) => moneyText(value, intl.locale),
    },
    {
      title: t('campaign.costs.col.currency'),
      dataIndex: 'currency',
      render: (value: unknown) => orDash(value || currency),
    },
    {
      title: t('campaign.costs.col.remark'),
      dataIndex: 'remark',
      render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={260} />,
    },
    {
      title: t('campaign.costs.col.by'),
      dataIndex: 'createdByUsername',
      render: (value: unknown) => orDash(value),
    },
    {
      title: t('campaign.costs.col.createdAt'),
      dataIndex: 'createdAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
    {
      title: t('campaign.costs.col.actions'),
      key: 'actions',
      fixed: 'right',
      render: (_, row) =>
        canManage ? (
          <Flex gap={4}>
            <Button type="link" size="small" onClick={() => setEditing(row)}>
              {t('campaign.costs.edit')}
            </Button>
            <DangerConfirmButton
              confirmText={t('campaign.costs.deleteConfirm', {
                // A name of any length: the question stays short enough for its buttons to be reached.
                name: clipCodePoints(nameOf(row), 60),
                date: plainText(row.statDate),
              })}
              onConfirm={() => remove(row)}
            >
              {t('campaign.costs.delete')}
            </DangerConfirmButton>
          </Flex>
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('campaign.costs.note')}
      </Typography.Paragraph>
      <Alert
        type="info"
        showIcon
        data-testid="campaign-costs-currency-lock"
        title={t('campaign.costs.currencyLock')}
      />
      <Flex gap={12} wrap align="center" justify="space-between">
        <Flex gap={12} wrap align="center">
          <CampaignSelect
            list={campaigns}
            value={draft.campaignId}
            onChange={(campaignId) => setDraft((d) => ({ ...d, campaignId }))}
          />
          <DateRangeUtc
            value={draft.range}
            onChange={(range) => setDraft((d) => ({ ...d, range }))}
          />
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
        {canManage ? (
          <Flex gap={8} wrap>
            <Button type="primary" onClick={() => setEditing('new')}>
              {t('campaign.costs.enter')}
            </Button>
            <Button onClick={() => setImporting(true)}>{t('campaign.costs.batch')}</Button>
          </Flex>
        ) : null}
      </Flex>
      <PagedTable<AttributionCost>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('campaign.costs.empty')}
      />
      {editing !== null ? (
        <CostModal
          cost={editing === 'new' ? null : editing}
          campaigns={campaigns.rows}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={state.reload}
        />
      ) : null}
      {importing ? (
        <BatchModal
          settings={settings}
          onClose={() => setImporting(false)}
          onSaved={state.reload}
        />
      ) : null}
    </Flex>
  );
}
