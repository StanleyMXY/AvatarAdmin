import { InfoCircleOutlined } from '@ant-design/icons';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Input, Select, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type AdCampaign,
  CAMPAIGN_STATUSES,
  type CampaignStatus,
  deleteCampaign,
  listCampaigns,
  listUnits,
  loadAllPages,
  setCampaignStatus,
} from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { CampaignModal } from './CampaignModal';
import { Checklist } from './Checklist';
import { PagedTable } from './PagedTable';
import { adminText, countText, instantText } from './texts';
import { useOptions } from './useOptions';
import { useServerPage } from './useServerPage';

type Filters = { name: string; status: string };
const NO_FILTERS: Filters = { name: '', status: '' };

const STATUS_COLOR: Record<CampaignStatus, string | undefined> = {
  DRAFT: undefined,
  ACTIVE: 'green',
  PAUSED: 'orange',
  ENDED: 'default',
};

/**
 * 计划: the campaigns, the top of the four-layer model. A campaign is edited while it is not ended;
 * the buttons are the state changes (each asks first) and the delete (a draft, or an ended campaign
 * without units; the backend decides the second part). The end time is enforced by the backend,
 * which ends the campaign by itself when it has passed.
 */
export default function CampaignsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('ADS:CAMPAIGN');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<AdCampaign | 'new' | null>(null);

  // The units are read with ADS:UNIT (or ADS:CREATIVE): where they can be read, a campaign that has
  // a unit is not offered for deletion; where they cannot, the backend decides and says no.
  const units = useOptions(() => loadAllPages((page, pageSize) => listUnits({ page, pageSize })));
  const campaignsWithUnits = useMemo(
    () => new Set(units.status === 'ready' ? units.rows.map((u) => String(u.campaignId)) : []),
    [units.status, units.rows],
  );

  const state = useServerPage<AdCampaign, Filters>(
    (query) =>
      listCampaigns({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.name ? { name: query.name } : {}),
        ...(query.status ? { status: query.status as CampaignStatus } : {}),
      }),
    applied,
  );

  const search = () => {
    setApplied({ name: trimSpec(draft.name), status: draft.status });
    state.search();
  };

  const statusOptions = Object.fromEntries(
    CAMPAIGN_STATUSES.map((s) => [
      s,
      { label: t(`ads.status.campaign.${s}`), color: STATUS_COLOR[s] },
    ]),
  );

  /** One request; a refusal is shown in the words of its code, and the list is read again either way. */
  const act = (change: () => Promise<unknown>) => async () => {
    try {
      await change();
      message.success(t('ads.common.saved'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    state.reload();
  };

  const actionsOf = (row: AdCampaign): RowAction[] => {
    if (!canWrite) return [];
    const id = plainText(row.id);
    const go = (status: CampaignStatus) => act(() => setCampaignStatus(id, status));
    const actions: RowAction[] = [];
    if (row.status !== 'ENDED') {
      actions.push({ key: 'edit', label: t('ads.common.edit'), onClick: () => setEditing(row) });
    }
    if (row.status === 'DRAFT') {
      actions.push({
        key: 'activate',
        label: t('ads.campaigns.activate'),
        confirmText: t('ads.campaigns.activateAsk'),
        onClick: go('ACTIVE'),
      });
    }
    if (row.status === 'ACTIVE') {
      actions.push({
        key: 'pause',
        label: t('ads.campaigns.pause'),
        confirmText: t('ads.campaigns.pauseAsk'),
        onClick: go('PAUSED'),
      });
    }
    if (row.status === 'PAUSED') {
      actions.push({
        key: 'resume',
        label: t('ads.campaigns.resume'),
        confirmText: t('ads.campaigns.resumeAsk'),
        onClick: go('ACTIVE'),
      });
    }
    if (row.status !== 'ENDED') {
      actions.push({
        key: 'end',
        label: t('ads.campaigns.end'),
        confirmText: t('ads.campaigns.endAsk'),
        onClick: go('ENDED'),
      });
    }
    if (row.status === 'DRAFT' || row.status === 'ENDED') {
      actions.push({
        key: 'delete',
        label: t('ads.common.delete'),
        confirmText: t('ads.campaigns.deleteAsk'),
        disabled: campaignsWithUnits.has(id),
        onClick: act(() => deleteCampaign(id)),
      });
    }
    return actions;
  };

  const columns: ColumnsType<AdCampaign> = [
    {
      key: 'name',
      title: t('ads.campaigns.col.name'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={240} />,
    },
    {
      key: 'status',
      title: t('ads.campaigns.col.status'),
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      key: 'priority',
      title: t('ads.campaigns.col.priority'),
      align: 'end',
      render: (_, row) => countText(intl.locale, row.priority),
    },
    {
      key: 'startAt',
      title: t('ads.campaigns.col.startAt'),
      render: (_, row) => instantText(intl.locale, row.startAt),
    },
    {
      key: 'endAt',
      title: (
        <>
          {t('ads.campaigns.col.endAt')}
          <Tooltip title={t('ads.campaigns.autoEnd')}>
            <InfoCircleOutlined style={{ marginInlineStart: 4 }} />
          </Tooltip>
        </>
      ),
      render: (_, row) => instantText(intl.locale, row.endAt),
    },
    {
      key: 'createdBy',
      title: t('ads.campaigns.col.createdBy'),
      render: (_, row) => adminText(row.createdByUsername, row.createdBy),
    },
    {
      key: 'updatedAt',
      title: t('ads.campaigns.col.updatedAt'),
      render: (_, row) => instantText(intl.locale, row.updatedAt),
    },
    {
      key: 'actions',
      title: t('ads.common.actions'),
      render: (_, row) => (
        <Flex vertical>
          <RowActions actions={actionsOf(row)} />
          {canWrite &&
          (row.status === 'DRAFT' || row.status === 'ENDED') &&
          campaignsWithUnits.has(plainText(row.id)) ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('ads.campaigns.hasUnits')}
            </Typography.Text>
          ) : null}
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Checklist />
      <Alert type="info" showIcon title={t('ads.campaigns.autoEnd')} />
      <Flex gap={8} wrap align="center">
        <Input
          allowClear
          style={{ width: 240 }}
          dir="auto"
          aria-label={t('ads.campaigns.filter.name')}
          placeholder={t('ads.campaigns.filter.name')}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onPressEnter={search}
        />
        <Select
          allowClear
          style={{ minWidth: 160 }}
          aria-label={t('ads.campaigns.filter.status')}
          placeholder={t('ads.campaigns.filter.status')}
          value={draft.status || undefined}
          options={CAMPAIGN_STATUSES.map((s) => ({
            value: s,
            label: t(`ads.status.campaign.${s}`),
          }))}
          onChange={(status) => setDraft((d) => ({ ...d, status: status ?? '' }))}
        />
        <Button type="primary" onClick={search}>
          {t('ads.common.search')}
        </Button>
        {canWrite ? (
          <Button onClick={() => setEditing('new')}>{t('ads.campaigns.new')}</Button>
        ) : null}
      </Flex>
      <PagedTable<AdCampaign>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('ads.campaigns.empty')}
      />
      <CampaignModal
        open={editing !== null}
        campaign={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={state.reload}
      />
    </Flex>
  );
}
