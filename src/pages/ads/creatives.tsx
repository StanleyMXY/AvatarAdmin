import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Select, Switch, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedTable } from '../../components/PagedTable';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { useServerPage } from '../../hooks/useServerPage';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AdCreative,
  CREATIVE_TYPES,
  deleteCreative,
  listCampaigns,
  listCreatives,
  listPlacements,
  listUnits,
  loadAllPages,
  REVIEW_STATUSES,
  type ReviewStatus,
  reviewCreative,
  SERVING_STATUSES,
  type ServingStatus,
  setServingStatus,
} from '../../services/ads';
import { listConfig } from '../../services/config';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Checklist } from './Checklist';
import { CreativeModal } from './CreativeModal';
import { Picker } from './Picker';
import { Thumb } from './Thumb';
import { codeText, countText } from './texts';
import { useOptions } from './useOptions';
import { useRead } from './useRead';

type Filters = {
  adUnitId: string;
  campaignId: string;
  reviewStatus: string;
  servingStatus: string;
  type: string;
};
const NO_FILTERS: Filters = {
  adUnitId: '',
  campaignId: '',
  reviewStatus: '',
  servingStatus: '',
  type: '',
};

const REVIEW_COLOR: Record<ReviewStatus, string | undefined> = {
  DRAFT: undefined,
  APPROVED: 'green',
  REJECTED: 'red',
};

/** `ads.creative_aspect_tolerance_percent` as the configuration says, or `null` when this administrator cannot read it. */
async function readTolerance(): Promise<number | null> {
  try {
    const row = (await listConfig()).items.find(
      (i) => i.key === 'ads.creative_aspect_tolerance_percent',
    );
    return typeof row?.value === 'number' ? row.value : null;
  } catch {
    return null;
  }
}

/** The switch of the serving status of an approved creative: it takes effect at once and needs no new review. */
function ServingSwitch({
  row,
  label,
  onDone,
}: {
  row: AdCreative;
  label: string;
  onDone: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { run, pending } = useSingleFlight(async (next: boolean) => {
    try {
      await setServingStatus(plainText(row.id), next ? 'ACTIVE' : 'PAUSED');
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    onDone();
  });
  return (
    <Switch
      checked={row.servingStatus === 'ACTIVE'}
      loading={pending}
      aria-label={label}
      onChange={(next) => void run(next).catch(() => {})}
    />
  );
}

/**
 * 素材: the creatives, the pictures and videos that are shown. The two states are kept apart: the
 * review (draft, approved, rejected) and the serving (running, paused; only an approved creative
 * has one). A creative that has been approved is neither edited nor deleted: it is paused, and a
 * new one is made to replace it.
 */
export default function CreativesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('ADS:CREATIVE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<AdCreative | 'new' | null>(null);
  const [rejecting, setRejecting] = useState<AdCreative | null>(null);

  const units = useOptions(() => loadAllPages((page, pageSize) => listUnits({ page, pageSize })));
  const campaigns = useOptions(() =>
    loadAllPages((page, pageSize) => listCampaigns({ page, pageSize })),
  );
  const placements = useOptions(listPlacements);
  const tolerance = useRead(readTolerance);

  const state = useServerPage<AdCreative, Filters>(
    (query) =>
      listCreatives({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.adUnitId ? { adUnitId: query.adUnitId } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.reviewStatus ? { reviewStatus: query.reviewStatus as ReviewStatus } : {}),
        ...(query.servingStatus ? { servingStatus: query.servingStatus as ServingStatus } : {}),
        ...(query.type ? { type: query.type } : {}),
      }),
    applied,
  );

  const search = () => {
    setApplied({ ...draft });
    state.search();
  };

  const unitOptions = units.rows.map((u) => ({ value: String(u.id), label: plainText(u.name) }));
  const campaignOptions = campaigns.rows.map((c) => ({
    value: String(c.id),
    label: plainText(c.name),
  }));
  const unitName = (id: unknown) =>
    unitOptions.find((o) => o.value === String(id))?.label ?? plainText(id);

  const reviewOptions = Object.fromEntries(
    REVIEW_STATUSES.map((s) => [s, { label: t(`ads.status.review.${s}`), color: REVIEW_COLOR[s] }]),
  );

  const act = (change: () => Promise<unknown>) => async () => {
    try {
      await change();
      message.success(t('ads.common.saved'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    state.reload();
  };

  const actionsOf = (row: AdCreative): RowAction[] => {
    if (!canWrite) return [];
    const id = plainText(row.id);
    const actions: RowAction[] = [];
    if (row.reviewStatus === 'DRAFT' || row.reviewStatus === 'REJECTED') {
      actions.push({ key: 'edit', label: t('ads.common.edit'), onClick: () => setEditing(row) });
    }
    if (row.reviewStatus === 'DRAFT') {
      actions.push({
        key: 'approve',
        label: t('ads.creatives.approve'),
        confirmText: t('ads.creatives.approveAsk'),
        onClick: act(() => reviewCreative(id, { reviewStatus: 'APPROVED' })),
      });
      actions.push({
        key: 'reject',
        label: t('ads.creatives.reject'),
        onClick: () => setRejecting(row),
      });
    }
    if (row.reviewStatus === 'DRAFT' || row.reviewStatus === 'REJECTED') {
      actions.push({
        key: 'delete',
        label: t('ads.common.delete'),
        confirmText: t('ads.creatives.deleteAsk'),
        onClick: act(() => deleteCreative(id)),
      });
    }
    return actions;
  };

  const columns: ColumnsType<AdCreative> = [
    {
      key: 'thumbnail',
      title: t('ads.creatives.col.thumbnail'),
      render: (_, row) => <Thumb url={row.thumbnailUrl} />,
    },
    {
      key: 'unit',
      title: t('ads.creatives.col.unit'),
      render: (_, row) => (
        <EllipsisPopoverText text={unitName(row.adUnitId)} lines={2} width={200} />
      ),
    },
    {
      key: 'type',
      title: t('ads.creatives.col.type'),
      render: (_, row) => codeText(intl, 'ads.creatives.type', row.type),
    },
    {
      key: 'language',
      title: t('ads.creatives.col.language'),
      render: (_, row) =>
        row.language === '*' ? (
          t('ads.creatives.allLanguages')
        ) : (
          <span style={{ overflowWrap: 'anywhere' }}>{plainText(row.language) || DASH}</span>
        ),
    },
    {
      key: 'review',
      title: t('ads.creatives.col.review'),
      render: (_, row) => (
        <Flex vertical gap={4} align="start">
          <StatusTag status={plainText(row.reviewStatus)} options={reviewOptions} />
          {row.reviewStatus === 'REJECTED' && plainText(row.reviewNote) !== '' ? (
            <EllipsisPopoverText text={plainText(row.reviewNote)} lines={2} width={200} />
          ) : null}
        </Flex>
      ),
    },
    {
      key: 'serving',
      title: t('ads.creatives.col.serving'),
      render: (_, row) =>
        row.reviewStatus === 'APPROVED' ? (
          <Flex gap={8} align="center">
            <ServingSwitch
              row={row}
              label={t('ads.creatives.servingOf', { unit: unitName(row.adUnitId) })}
              onDone={state.reload}
            />
            <span>{codeText(intl, 'ads.status.serving', row.servingStatus)}</span>
          </Flex>
        ) : (
          DASH
        ),
    },
    {
      key: 'weight',
      title: t('ads.creatives.col.weight'),
      align: 'end',
      render: (_, row) => countText(intl.locale, row.weight),
    },
    {
      key: 'actions',
      title: t('ads.common.actions'),
      render: (_, row) =>
        row.reviewStatus === 'APPROVED' ? (
          <Typography.Text type="secondary" style={{ maxWidth: 220, display: 'inline-block' }}>
            {t('ads.creatives.approvedHint')}
          </Typography.Text>
        ) : (
          <RowActions actions={actionsOf(row)} />
        ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Checklist />
      <Alert
        type="info"
        showIcon
        data-testid="ads-creatives-weight-note"
        title={t('ads.creatives.weightNote')}
      />
      <Flex gap={8} wrap align="start">
        <Picker
          label={t('ads.creatives.filter.unit')}
          status={units.status}
          options={unitOptions}
          permission="ADS:UNIT"
          onRetry={units.reload}
          allowClear
          value={draft.adUnitId || undefined}
          onChange={(adUnitId) => setDraft((d) => ({ ...d, adUnitId: adUnitId ?? '' }))}
        />
        <Picker
          label={t('ads.creatives.filter.campaign')}
          status={campaigns.status}
          options={campaignOptions}
          permission="ADS:CAMPAIGN"
          onRetry={campaigns.reload}
          allowClear
          value={draft.campaignId || undefined}
          onChange={(campaignId) => setDraft((d) => ({ ...d, campaignId: campaignId ?? '' }))}
        />
        <Select
          allowClear
          style={{ minWidth: 160 }}
          aria-label={t('ads.creatives.filter.review')}
          placeholder={t('ads.creatives.filter.review')}
          value={draft.reviewStatus || undefined}
          options={REVIEW_STATUSES.map((s) => ({ value: s, label: t(`ads.status.review.${s}`) }))}
          onChange={(reviewStatus) => setDraft((d) => ({ ...d, reviewStatus: reviewStatus ?? '' }))}
        />
        <Select
          allowClear
          style={{ minWidth: 160 }}
          aria-label={t('ads.creatives.filter.serving')}
          placeholder={t('ads.creatives.filter.serving')}
          value={draft.servingStatus || undefined}
          options={SERVING_STATUSES.map((s) => ({ value: s, label: t(`ads.status.serving.${s}`) }))}
          onChange={(servingStatus) =>
            setDraft((d) => ({ ...d, servingStatus: servingStatus ?? '' }))
          }
        />
        <Select
          allowClear
          style={{ minWidth: 130 }}
          aria-label={t('ads.creatives.filter.type')}
          placeholder={t('ads.creatives.filter.type')}
          value={draft.type || undefined}
          options={CREATIVE_TYPES.map((s) => ({ value: s, label: t(`ads.creatives.type.${s}`) }))}
          onChange={(type) => setDraft((d) => ({ ...d, type: type ?? '' }))}
        />
        <Button type="primary" onClick={search}>
          {t('ads.common.search')}
        </Button>
        {canWrite ? (
          <Button onClick={() => setEditing('new')}>{t('ads.creatives.new')}</Button>
        ) : null}
      </Flex>
      <PagedTable<AdCreative>
        state={state}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('ads.creatives.empty')}
      />
      {/* Mounted only while it is open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <CreativeModal
          open
          creative={editing === 'new' ? null : editing}
          units={units}
          placements={placements}
          tolerance={tolerance.data ?? null}
          onClose={() => setEditing(null)}
          onSaved={state.reload}
        />
      ) : null}
      <ReasonModalForm
        open={rejecting !== null}
        title={t('ads.creatives.rejectTitle')}
        reasonLabel={t('ads.creatives.rejectNote')}
        hint={t('ads.creatives.rejectHint')}
        onClose={() => setRejecting(null)}
        onSubmit={async (note) => {
          if (!rejecting) return;
          await reviewCreative(plainText(rejecting.id), {
            reviewStatus: 'REJECTED',
            reviewNote: note,
          });
          message.success(t('ads.common.saved'));
          setRejecting(null);
          state.reload();
        }}
      />
    </Flex>
  );
}
