import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { ApiError } from '../../request/errors';
import { listPrices, loadAllPages, type PriceBatch, retireBatch } from '../../services/cost';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { todayUtc } from '../../utils/utcDay';
import { labelOf } from './labels';
import { PriceLines } from './PriceLines';
import { useLatestRead } from './useLatestRead';
import { WrapText } from './WrapText';

type Access = { canAccess: (code?: string) => boolean };

type Group = {
  key: string;
  resourceType: string;
  provider: string;
  model: string;
  /** The batch in force today: the `ACTIVE` one with the latest date that has come. */
  current: PriceBatch | null;
  /** The other batches of the model, newest first; a batch waiting for review is in the pending tab, not here. */
  history: PriceBatch[];
};

/** Groups the batches by model (resource type, provider, model, unit) in the order the backend sent them. */
export function groupBatches(batches: PriceBatch[], today: string): Group[] {
  const groups = new Map<string, PriceBatch[]>();
  for (const batch of batches) {
    const key = [batch.resourceType, batch.provider, batch.model, batch.unit].join('\u0000');
    groups.set(key, [...(groups.get(key) ?? []), batch]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) =>
      a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0,
    );
    const current = sorted.find((b) => b.status === 'ACTIVE' && b.effectiveFrom <= today) ?? null;
    return {
      key,
      resourceType: list[0].resourceType,
      provider: list[0].provider,
      model: list[0].model,
      current,
      history: sorted.filter((b) => b !== current && b.status !== 'PENDING_REVIEW'),
    };
  });
}

/**
 * 当前价格: the batch in force for each model (by band, with currency and date), and under each model
 * its other batches (replaced, rejected, withdrawn, and one that starts later). An `ACTIVE` batch can be
 * withdrawn (a note is required, `COST:PRICE`); a saved batch has no edit.
 */
export function CurrentTab() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const canPrice = access.canAccess('COST:PRICE');
  const fetcher = useCallback(
    () => loadAllPages(({ page, pageSize }) => listPrices({ page, pageSize })),
    [],
  );
  const { data, failure, reload } = useLatestRead(fetcher);
  const [retiring, setRetiring] = useState<PriceBatch | null>(null);
  const groups = useMemo(() => (data ? groupBatches(data.items, todayUtc()) : []), [data]);
  const today = todayUtc();

  const withdraw = (batch: PriceBatch) => (
    <Button size="small" danger onClick={() => setRetiring(batch)}>
      {t('cost.current.retire')}
    </Button>
  );

  const statusTag = (batch: PriceBatch) => (
    <Tag
      color={batch.status === 'ACTIVE' ? 'green' : batch.status === 'REJECTED' ? 'red' : undefined}
    >
      {labelOf(intl, 'cost.prices.status', batch.status)}
    </Tag>
  );

  const historyColumns: ColumnsType<PriceBatch> = [
    {
      key: 'status',
      title: t('cost.current.col.status'),
      render: (_, b) => (
        <Flex gap={4} wrap>
          {statusTag(b)}
          {b.status === 'ACTIVE' && b.effectiveFrom > today ? (
            <Tag>{t('cost.prices.notYet')}</Tag>
          ) : null}
        </Flex>
      ),
    },
    { key: 'from', title: t('cost.current.col.effectiveFrom'), render: (_, b) => b.effectiveFrom },
    {
      key: 'currency',
      title: t('cost.current.col.currency'),
      render: (_, b) => <WrapText value={b.currency} />,
    },
    {
      key: 'price',
      title: t('cost.current.col.price'),
      render: (_, b) => <PriceLines batch={b} />,
    },
    {
      key: 'source',
      title: t('cost.current.col.source'),
      render: (_, b) => labelOf(intl, 'cost.prices.source', b.source),
    },
    {
      key: 'confirmed',
      title: t('cost.current.col.confirmedBy'),
      render: (_, b) =>
        b.confirmedBy === null ? DASH : <WrapText value={b.confirmedByUsername ?? b.confirmedBy} />,
    },
    {
      key: 'reviewed',
      title: t('cost.current.col.reviewedBy'),
      render: (_, b) =>
        b.reviewedBy === null ? (
          DASH
        ) : (
          <span>
            <WrapText value={b.reviewedByUsername ?? b.reviewedBy} />
            {b.reviewedAt ? ` · ${formatInstant(b.reviewedAt, intl.locale)}` : ''}
          </span>
        ),
    },
    {
      key: 'note',
      title: t('cost.current.col.reviewNote'),
      render: (_, b) => <WrapText value={b.reviewNote} lines={4} />,
    },
    ...(canPrice
      ? [
          {
            key: 'actions',
            title: t('cost.current.col.actions'),
            render: (_: unknown, b: PriceBatch) => (b.status === 'ACTIVE' ? withdraw(b) : null),
          },
        ]
      : []),
  ];

  const columns: ColumnsType<Group> = [
    {
      key: 'model',
      title: t('cost.current.col.model'),
      render: (_, g) => (
        <Flex vertical gap={2} style={{ maxWidth: 320 }}>
          <Typography.Text strong>
            <WrapText value={g.model} testId="current-model" lines={3} />
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {labelOf(intl, 'cost.resourceType', g.resourceType)} · <WrapText value={g.provider} />
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'price',
      title: t('cost.current.col.price'),
      render: (_, g) =>
        g.current ? (
          <PriceLines batch={g.current} />
        ) : (
          <Tag color="red">{t('cost.prices.noActive')}</Tag>
        ),
    },
    {
      key: 'currency',
      title: t('cost.current.col.currency'),
      render: (_, g) => (g.current ? <WrapText value={g.current.currency} /> : DASH),
    },
    {
      key: 'from',
      title: t('cost.current.col.effectiveFrom'),
      render: (_, g) => g.current?.effectiveFrom ?? DASH,
    },
    {
      key: 'source',
      title: t('cost.current.col.source'),
      render: (_, g) => (g.current ? labelOf(intl, 'cost.prices.source', g.current.source) : DASH),
    },
    ...(canPrice
      ? [
          {
            key: 'actions',
            title: t('cost.current.col.actions'),
            render: (_: unknown, g: Group) => (g.current ? withdraw(g.current) : null),
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={12}>
      <Alert type="info" showIcon data-testid="current-note" title={t('cost.current.note')} />
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {data === null && !failure ? <Spin /> : null}
      {data && !data.complete ? (
        <Alert
          type="warning"
          showIcon
          title={t('cost.common.truncated', { shown: data.items.length, total: data.total })}
        />
      ) : null}
      {data ? (
        <Table<Group>
          size="small"
          rowKey="key"
          columns={columns}
          dataSource={groups}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('cost.current.empty') }}
          expandable={{
            expandedRowRender: (g, index) => (
              <div data-testid={`history-${index}`}>
                <Typography.Text strong>{t('cost.current.history')}</Typography.Text>
                {g.history.length === 0 ? (
                  <div>
                    <Typography.Text type="secondary">
                      {t('cost.current.historyEmpty')}
                    </Typography.Text>
                  </div>
                ) : (
                  <Table<PriceBatch>
                    size="small"
                    rowKey="batchId"
                    columns={historyColumns}
                    dataSource={g.history}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </div>
            ),
          }}
        />
      ) : null}

      <ReasonModalForm
        open={retiring !== null}
        title={t('cost.current.retireTitle')}
        reasonLabel={t('cost.current.retireNote')}
        hint={t('cost.current.retireHint')}
        onClose={() => setRetiring(null)}
        onSubmit={async (note) => {
          if (!retiring) return;
          try {
            await retireBatch(retiring.batchId, note);
          } catch (error) {
            if (error instanceof ApiError && error.code === 'INVALID_STATE') reload();
            throw error;
          }
          message.success(t('cost.current.retired'));
          setRetiring(null);
          reload();
        }}
      />
    </Flex>
  );
}
