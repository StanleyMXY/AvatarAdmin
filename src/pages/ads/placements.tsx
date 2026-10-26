import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Card, Flex, Spin, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type AdPlacement, listPlacements, updatePlacement } from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { formatBytes } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { ConfigForm } from '../config/ConfigForm';
import { AdsWarnings } from './AdsWarnings';
import { Checklist } from './Checklist';
import { FailureBar } from './FailureBar';
import { PlacementModal } from './PlacementModal';
import { dailyMax } from './placementRows';
import { codeText, countText } from './texts';
import { useRead } from './useRead';

/** The switch of a placement: one request per change, and the list is read again afterwards so that it shows what the backend holds. */
function EnabledSwitch({
  row,
  disabled,
  onDone,
}: {
  row: AdPlacement;
  disabled: boolean;
  onDone: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { run, pending } = useSingleFlight(async (next: boolean) => {
    try {
      await updatePlacement(plainText(row.id), { enabled: next });
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    onDone();
  });
  return (
    <Switch
      checked={row.enabled === true}
      loading={pending}
      disabled={disabled}
      aria-label={intl.formatMessage(
        { id: 'ads.placements.enabledOf' },
        { slot: plainText(row.slotKey) },
      )}
      onChange={(next) => void run(next).catch(() => {})}
    />
  );
}

/**
 * 广告位与全局设置: the global settings of `ads.*` (nine keys of `ADS:PLACEMENT`; the tenth, the
 * retention of the impression log, is edited on the system configuration page) and the four preset
 * placements. A placement is switched, capped and given a cooldown or a reward here, never added or
 * deleted. The notes say what the master switch, a cap of 0 and the counting of impressions mean.
 */
export default function PlacementsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('ADS:PLACEMENT');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [editing, setEditing] = useState<AdPlacement | null>(null);
  const { data, failure, loading, reload } = useRead(listPlacements);

  const columns: ColumnsType<AdPlacement> = [
    {
      key: 'slotKey',
      title: t('ads.placements.col.slotKey'),
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{plainText(row.slotKey)}</span>
      ),
    },
    {
      key: 'format',
      title: t('ads.placements.col.format'),
      render: (_, row) => codeText(intl, 'ads.format', row.adFormat),
    },
    {
      key: 'name',
      title: t('ads.placements.col.name'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={200} />,
    },
    {
      key: 'enabled',
      title: t('ads.placements.col.enabled'),
      render: (_, row) => <EnabledSwitch row={row} disabled={!canWrite} onDone={reload} />,
    },
    {
      key: 'frequencyCap',
      title: t('ads.placements.col.frequencyCap'),
      render: (_, row) => (
        <Flex vertical>
          <span>{countText(intl.locale, row.frequencyCap)}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 220 }}>
            {t(
              row.adFormat === 'REWARDED'
                ? 'ads.placements.capNoteRewarded'
                : 'ads.placements.capNote',
            )}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'cooldown',
      title: t('ads.placements.col.cooldown'),
      render: (_, row) => {
        if (row.adFormat === 'REWARDED' || typeof row.cooldownMinutes !== 'number') return DASH;
        return row.cooldownMinutes === 0
          ? t('ads.placements.noCooldown')
          : countText(intl.locale, row.cooldownMinutes);
      },
    },
    {
      key: 'reward',
      title: t('ads.placements.col.reward'),
      render: (_, row) => {
        if (row.adFormat !== 'REWARDED') return DASH;
        const total = dailyMax(row.frequencyCap, row.rewardCredits);
        return (
          <Flex vertical>
            <span>{countText(intl.locale, row.rewardCredits)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 260 }}>
              {t('ads.placements.dailyMax', {
                cap: countText(intl.locale, row.frequencyCap),
                reward: countText(intl.locale, row.rewardCredits),
                total: total === null ? DASH : countText(intl.locale, total),
              })}
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      key: 'spec',
      title: t('ads.placements.col.spec'),
      render: (_, row) => {
        const parts = [
          plainText(row.creativeAspect),
          typeof row.creativeMinShortSide === 'number'
            ? t('ads.placements.specShortSide', { pixels: row.creativeMinShortSide })
            : '',
          typeof row.creativeMaxBytes === 'number'
            ? t('ads.placements.specMaxBytes', {
                size: formatBytes(row.creativeMaxBytes, intl.locale),
              })
            : '',
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' · ') : DASH;
      },
    },
    {
      key: 'actions',
      title: t('ads.common.actions'),
      render: (_, row) =>
        canWrite ? (
          <Button type="link" size="small" onClick={() => setEditing(row)}>
            {t('ads.common.edit')}
          </Button>
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Checklist />
      <Alert
        type="info"
        showIcon
        data-testid="ads-placements-notes"
        title={
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>{t('ads.placements.note.master')}</li>
            <li>{t('ads.placements.note.testing')}</li>
            <li>{t('ads.placements.note.counting')}</li>
          </ul>
        }
      />
      <Card size="small" title={t('ads.placements.globalTitle')}>
        <Flex vertical gap={12}>
          <AdsWarnings placements={data} />
          <ConfigForm editPermission="ADS:PLACEMENT" />
        </Flex>
      </Card>
      <Card size="small" title={t('ads.placements.tableTitle')}>
        <Flex vertical gap={12}>
          {failure ? <FailureBar failure={failure} onRetry={reload} /> : null}
          {loading && !failure ? <Spin /> : null}
          {data ? (
            <Table<AdPlacement>
              size="small"
              rowKey={(row) => plainText(row.id)}
              columns={columns}
              dataSource={data}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('ads.placements.empty') }}
            />
          ) : null}
        </Flex>
      </Card>
      <PlacementModal
        open={editing !== null}
        placement={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </Flex>
  );
}
