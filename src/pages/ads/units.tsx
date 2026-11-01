import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Input, Select, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedTable } from '../../components/PagedTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { useLatestRead } from '../../hooks/useLatestRead';
import { useServerPage } from '../../hooks/useServerPage';
import {
  type AdUnit,
  deleteUnit,
  getAdsMeta,
  listCampaigns,
  listPlacements,
  listUnits,
  loadAllPages,
  setUnitStatus,
  UNIT_STATUSES,
  type UnitStatus,
} from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { countText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { Checklist } from './Checklist';
import { Picker } from './Picker';
import { summarizeTargeting } from './targeting';
import { UnitModal } from './UnitModal';
import { useOptions } from './useOptions';

type Filters = { campaignId: string; placementId: string; status: string; name: string };
const NO_FILTERS: Filters = { campaignId: '', placementId: '', status: '', name: '' };

const STATUS_COLOR: Record<UnitStatus, string | undefined> = {
  DRAFT: undefined,
  ACTIVE: 'green',
  PAUSED: 'orange',
};

/**
 * 单元: a unit is a campaign at a placement, with the targeting, the weight and the daily cap. The
 * campaigns and the placements it names are read with the permissions of their own pages, so a
 * unit shows the id where the name cannot be read. A unit is deleted only while it is a draft (the
 * backend also wants it empty of creatives).
 */
export default function UnitsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('ADS:UNIT');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<AdUnit | 'new' | null>(null);

  const campaigns = useOptions(() =>
    loadAllPages((page, pageSize) => listCampaigns({ page, pageSize })),
  );
  const placements = useOptions(listPlacements);
  const meta = useLatestRead(getAdsMeta, { keepWhileReading: true });

  const state = useServerPage<AdUnit, Filters>(
    (query) =>
      listUnits({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.placementId ? { placementId: query.placementId } : {}),
        ...(query.status ? { status: query.status as UnitStatus } : {}),
        ...(query.name ? { name: query.name } : {}),
      }),
    applied,
  );

  const search = () => {
    setApplied({ ...draft, name: trimSpec(draft.name) });
    state.search();
  };

  const campaignOptions = campaigns.rows.map((c) => ({
    value: String(c.id),
    label: plainText(c.name),
  }));
  const placementOptions = placements.rows.map((p) => ({
    value: String(p.id),
    label: `${plainText(p.slotKey)} · ${plainText(p.name)}`,
  }));
  const campaignName = (id: unknown) =>
    campaignOptions.find((o) => o.value === String(id))?.label ?? plainText(id);
  const placementLabel = (id: unknown) =>
    placementOptions.find((o) => o.value === String(id))?.label ?? plainText(id);

  const statusOptions = Object.fromEntries(
    UNIT_STATUSES.map((s) => [s, { label: t(`ads.status.unit.${s}`), color: STATUS_COLOR[s] }]),
  );

  const act = (change: () => Promise<unknown>, refusedBy?: string) => async () => {
    try {
      await change();
      message.success(t('ads.common.saved'));
    } catch (error) {
      const failed = describeFailure(intl, error);
      // A 409 on the delete of a draft unit can only be the creatives it still has (contract 22.3).
      message.error(
        refusedBy && failed.error.code === 'INVALID_STATE'
          ? t(refusedBy, { reason: failed.text })
          : failed.text,
      );
    }
    state.reload();
  };

  const actionsOf = (row: AdUnit): RowAction[] => {
    if (!canWrite) return [];
    const id = plainText(row.id);
    const go = (status: UnitStatus) => act(() => setUnitStatus(id, status));
    const actions: RowAction[] = [
      { key: 'edit', label: t('ads.common.edit'), onClick: () => setEditing(row) },
    ];
    if (row.status === 'DRAFT') {
      actions.push({
        key: 'activate',
        label: t('ads.units.activate'),
        confirmText: t('ads.units.activateAsk'),
        onClick: go('ACTIVE'),
      });
    }
    if (row.status === 'ACTIVE') {
      actions.push({
        key: 'pause',
        label: t('ads.units.pause'),
        confirmText: t('ads.units.pauseAsk'),
        onClick: go('PAUSED'),
      });
    }
    if (row.status === 'PAUSED') {
      actions.push({
        key: 'resume',
        label: t('ads.units.resume'),
        confirmText: t('ads.units.resumeAsk'),
        onClick: go('ACTIVE'),
      });
    }
    if (row.status === 'DRAFT') {
      actions.push({
        key: 'delete',
        label: t('ads.common.delete'),
        confirmText: t('ads.units.deleteAsk'),
        onClick: act(() => deleteUnit(id), 'ads.units.deleteRefused'),
      });
    }
    return actions;
  };

  const columns: ColumnsType<AdUnit> = [
    {
      key: 'name',
      title: t('ads.units.col.name'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={220} />,
    },
    {
      key: 'campaign',
      title: t('ads.units.col.campaign'),
      render: (_, row) => (
        <EllipsisPopoverText text={campaignName(row.campaignId)} lines={2} width={200} />
      ),
    },
    {
      key: 'placement',
      title: t('ads.units.col.placement'),
      render: (_, row) => (
        <EllipsisPopoverText text={placementLabel(row.placementId)} lines={2} width={180} />
      ),
    },
    {
      key: 'status',
      title: t('ads.units.col.status'),
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      key: 'weight',
      title: t('ads.units.col.weight'),
      render: (_, row) => (
        <Flex gap={6} align="center" wrap>
          <span>{countText(intl.locale, row.weight)}</span>
          {row.weight === 0 ? (
            <Tag style={{ marginInlineEnd: 0 }}>{t('ads.units.neverSelected')}</Tag>
          ) : null}
        </Flex>
      ),
    },
    {
      key: 'dailyCap',
      title: t('ads.units.col.dailyCap'),
      align: 'end',
      render: (_, row) =>
        row.dailyImpressionCap === 0
          ? t('ads.units.noLimit')
          : countText(intl.locale, row.dailyImpressionCap),
    },
    {
      key: 'targeting',
      title: t('ads.units.col.targeting'),
      render: (_, row) => (
        <EllipsisPopoverText text={summarizeTargeting(intl, row.targeting)} lines={2} width={260} />
      ),
    },
    {
      key: 'actions',
      title: t('ads.common.actions'),
      render: (_, row) => <RowActions actions={actionsOf(row)} />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Checklist />
      <Flex gap={8} wrap align="start">
        <Picker
          label={t('ads.units.filter.campaign')}
          status={campaigns.status}
          options={campaignOptions}
          permission="ADS:CAMPAIGN"
          onRetry={campaigns.reload}
          allowClear
          value={draft.campaignId || undefined}
          onChange={(campaignId) => setDraft((d) => ({ ...d, campaignId: campaignId ?? '' }))}
        />
        <Picker
          label={t('ads.units.filter.placement')}
          status={placements.status}
          options={placementOptions}
          permission="ADS:PLACEMENT"
          onRetry={placements.reload}
          allowClear
          width={220}
          value={draft.placementId || undefined}
          onChange={(placementId) => setDraft((d) => ({ ...d, placementId: placementId ?? '' }))}
        />
        <Select
          allowClear
          style={{ minWidth: 150 }}
          aria-label={t('ads.units.filter.status')}
          placeholder={t('ads.units.filter.status')}
          value={draft.status || undefined}
          options={UNIT_STATUSES.map((s) => ({ value: s, label: t(`ads.status.unit.${s}`) }))}
          onChange={(status) => setDraft((d) => ({ ...d, status: status ?? '' }))}
        />
        <Input
          allowClear
          style={{ width: 220 }}
          dir="auto"
          aria-label={t('ads.units.filter.name')}
          placeholder={t('ads.units.filter.name')}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onPressEnter={search}
        />
        <Button type="primary" onClick={search}>
          {t('ads.common.search')}
        </Button>
        {canWrite ? <Button onClick={() => setEditing('new')}>{t('ads.units.new')}</Button> : null}
      </Flex>
      <PagedTable<AdUnit>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('ads.units.empty')}
      />
      {/* Mounted only while it is open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <UnitModal
          open
          unit={editing === 'new' ? null : editing}
          campaigns={campaigns}
          placements={placements}
          geoConfigured={meta.data?.geoConfigured ?? null}
          onClose={() => setEditing(null)}
          onSaved={state.reload}
        />
      ) : null}
    </Flex>
  );
}
