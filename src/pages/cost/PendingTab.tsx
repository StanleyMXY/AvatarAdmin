import { useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Flex,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { useLatestRead } from '../../hooks/useLatestRead';
import { ApiError } from '../../request/errors';
import {
  type Band,
  compareDecimals,
  confirmBatch,
  listPendingBatches,
  type PendingBatch,
  rejectBatch,
} from '../../services/cost';
import { clipCodePoints } from '../../utils/codePoints';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { pickedDay, todayUtc } from '../../utils/utcDay';
import { ActionModal } from './ActionModal';
import { BatchSummary } from './BatchSummary';
import { labelOf } from './labels';
import { rangeText } from './PriceLines';
import { Price, WrapText } from './WrapText';

type Access = { canAccess: (code?: string) => boolean };
type Intl = ReturnType<typeof useIntl>;

const same = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : compareDecimals(a, b) === 0;

/** The new price over the price in force; marked when it is not the same number (written with other trailing zeros is the same). */
function PriceCompare({
  now,
  was,
  hasActive,
  nowCurrency,
  wasCurrency,
}: {
  now: string | null;
  was: string | null;
  hasActive: boolean;
  nowCurrency: string;
  wasCurrency: string | undefined;
}) {
  const intl = useIntl();
  // The same number in another currency is not the same price.
  const changed = hasActive && (!same(now, was) || nowCurrency !== wasCurrency);
  return (
    <div
      data-changed={changed ? 'true' : undefined}
      style={changed ? { fontWeight: 600 } : undefined}
    >
      <div>
        <Price value={now} /> {nowCurrency}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {intl.formatMessage({ id: 'cost.prices.band.current' })}: <Price value={was} />
        {was !== null && wasCurrency ? ` ${wasCurrency}` : ''}
      </Typography.Text>
    </div>
  );
}

type BandRow = { key: string; now?: Band; was?: Band };

/** Band by band: bands are matched by their lower bound; a band that exists on one side only has a dash on the other. */
function bandRows(batch: PendingBatch): BandRow[] {
  const rows = new Map<number, BandRow>();
  for (const band of batch.bands ?? [])
    rows.set(band.inputMinTokens, { key: String(band.inputMinTokens), now: band });
  for (const band of batch.active?.bands ?? []) {
    const row = rows.get(band.inputMinTokens) ?? { key: String(band.inputMinTokens) };
    row.was = band;
    rows.set(band.inputMinTokens, row);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

function CompareTable({ batch, intl }: { batch: PendingBatch; intl: Intl }) {
  const t = (id: string) => intl.formatMessage({ id });
  const hasActive = batch.active !== null;
  if (batch.bands === null) {
    return (
      <div data-testid="compare-table">
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={[{ key: 'unit' }]}
          columns={[
            {
              title: t('cost.prices.price.unitPrice'),
              render: () => (
                <Flex gap={8} wrap align="baseline">
                  <PriceCompare
                    now={batch.unitPrice}
                    was={batch.active?.unitPrice ?? null}
                    hasActive={hasActive}
                    nowCurrency={batch.currency}
                    wasCurrency={batch.active?.currency}
                  />
                  <span>{labelOf(intl, 'cost.unit', batch.unit)}</span>
                </Flex>
              ),
            },
          ]}
        />
      </div>
    );
  }
  return (
    <div data-testid="compare-table">
      <Table<BandRow>
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={bandRows(batch)}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('cost.prices.band.range'),
            render: (_, row) => {
              const shown = row.now ?? (row.was as Band);
              const wasRange = row.was && row.now ? rangeText(intl, row.was) : null;
              return (
                <div>
                  <div>{rangeText(intl, shown)}</div>
                  {wasRange && wasRange !== rangeText(intl, shown) ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {intl.formatMessage({ id: 'cost.prices.band.was' }, { range: wasRange })}
                    </Typography.Text>
                  ) : null}
                  {!row.now ? <Typography.Text type="secondary"> {DASH}</Typography.Text> : null}
                </div>
              );
            },
          },
          ...(['inputPrice', 'cachedInputPrice', 'outputPrice'] as const).map((field) => ({
            title: t(`cost.prices.price.${field}`),
            render: (_: unknown, row: BandRow) => (
              <PriceCompare
                now={row.now?.[field] ?? null}
                was={row.was?.[field] ?? null}
                hasActive={hasActive}
                nowCurrency={batch.currency}
                wasCurrency={batch.active?.currency}
              />
            ),
          })),
        ]}
      />
    </div>
  );
}

type Confirming = { batch: PendingBatch; date: string; currency: string | undefined };

function PendingCard({
  batch,
  canPrice,
  allowed,
  onConfirm,
  onReject,
}: {
  batch: PendingBatch;
  canPrice: boolean;
  allowed: string[] | null | undefined;
  onConfirm: (c: Confirming) => void;
  onReject: (batch: PendingBatch) => void;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const listKnown = Array.isArray(allowed);
  // What the person chose; without a choice the batch's own currency, which counts when the list has it.
  // Worked out from the list as it is now, because the list can change while the card is on screen.
  const [chosen, setChosen] = useState<string | undefined>();
  const wanted = chosen ?? batch.currency;
  const currency = listKnown ? (allowed.includes(wanted) ? wanted : undefined) : wanted;
  const [date, setDate] = useState(batch.effectiveFrom);
  const needsCurrency = listKnown && currency === undefined;

  return (
    <Card size="small" data-testid={`pending-${batch.batchId}`}>
      <Flex vertical gap={12}>
        <Flex gap={8} wrap align="baseline">
          <Typography.Text strong>
            <WrapText value={batch.model} testId="pending-model" lines={3} />
          </Typography.Text>
          <Tag>{labelOf(intl, 'cost.resourceType', batch.resourceType)}</Tag>
          {/* A tag does not break its text by itself: a long provider name would widen the page. */}
          <Tag style={{ whiteSpace: 'normal', maxWidth: '100%', overflowWrap: 'anywhere' }}>
            <WrapText value={batch.provider} />
          </Tag>
          <Tag>{labelOf(intl, 'cost.prices.source', batch.source)}</Tag>
          {batch.active === null ? <Tag color="red">{t('cost.prices.noActive')}</Tag> : null}
        </Flex>
        <CompareTable batch={batch} intl={intl} />
        <Flex gap={16} wrap align="flex-start">
          <Flex vertical gap={4}>
            <Typography.Text type="secondary">{t('cost.pending.currency')}</Typography.Text>
            {canPrice ? (
              <>
                <Select
                  aria-label={t('cost.pending.currency')}
                  style={{ minWidth: 140 }}
                  disabled={!listKnown}
                  value={currency}
                  onChange={setChosen}
                  placeholder={listKnown ? undefined : t('cost.pending.noCurrencyList')}
                  options={(listKnown ? allowed : []).map((c) => ({ value: c, label: c }))}
                />
                {!listKnown ? (
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    {t('cost.pending.currencyMissing')}
                  </Typography.Text>
                ) : null}
                {needsCurrency ? (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>
                    {t('cost.pending.currencyNotAllowed')}
                  </Typography.Text>
                ) : null}
              </>
            ) : (
              <span>{batch.currency}</span>
            )}
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text type="secondary">{t('cost.pending.effectiveFrom')}</Typography.Text>
            <div data-testid="pending-date">
              {canPrice ? (
                <DatePicker
                  allowClear={false}
                  value={dayjs(`${date}T00:00:00`)}
                  onChange={(picked) => picked && setDate(pickedDay(picked))}
                />
              ) : (
                <span>{batch.effectiveFrom}</span>
              )}
            </div>
            {canPrice ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('cost.pending.effectiveFromHint')}
              </Typography.Text>
            ) : null}
          </Flex>
          {canPrice ? (
            <Flex gap={8} align="flex-end" style={{ alignSelf: 'flex-end' }}>
              <Button
                type="primary"
                disabled={needsCurrency}
                onClick={() => onConfirm({ batch, date, currency })}
              >
                {t('cost.pending.confirm')}
              </Button>
              <Button danger onClick={() => onReject(batch)}>
                {t('cost.pending.reject')}
              </Button>
            </Flex>
          ) : null}
        </Flex>
      </Flex>
    </Card>
  );
}

/**
 * 待审价格: the batches the price sync proposed, each compared band by band with the price in force.
 * Nothing is charged at a pending price before it is confirmed. Confirming (with the date and currency
 * checked here) and rejecting (a note is required) need `COST:PRICE`; both say what they do first.
 */
export function PendingTab({
  allowedCurrencies,
  readAllowed,
}: {
  allowedCurrencies: string[] | null | undefined;
  /** Reads the allowed currencies again (they can be changed on another page after sign-in); resolves when `allowedCurrencies` is up to date. */
  readAllowed: () => Promise<void>;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const canPrice = access.canAccess('COST:PRICE');
  const { data, failure, reload } = useLatestRead(listPendingBatches);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [rejecting, setRejecting] = useState<PendingBatch | null>(null);
  // The summary stays while the dialog closes.
  const rejectingShown = useRef<PendingBatch | null>(null);
  if (rejecting) rejectingShown.current = rejecting;
  const [reading, setReading] = useState(false);

  // Opening the confirm dialog reads the allowed currencies again; until that is back the dialog
  // cannot be confirmed, so the currency is checked against the list as it is now.
  const askConfirm = (c: Confirming) => {
    setConfirming(c);
    setReading(true);
    void readAllowed().finally(() => setReading(false));
  };

  // A batch that is no longer waiting (someone else decided it): show the list as it is now.
  const refreshOnConflict = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'INVALID_STATE') reload();
  };

  const listKnown = Array.isArray(allowedCurrencies);
  // The currency chosen on the card is not in the list as it is now (the list changed meanwhile).
  const currencyOutOfList =
    confirming !== null && listKnown && !allowedCurrencies.includes(confirming.currency ?? '');
  const today = todayUtc();

  return (
    <Flex vertical gap={12}>
      <Alert type="info" showIcon data-testid="pending-note" title={t('cost.pending.note')} />
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
      {data && data.items.length === 0 ? (
        <Typography.Text type="secondary">{t('cost.pending.empty')}</Typography.Text>
      ) : null}
      {data?.items.map((batch) => (
        <PendingCard
          key={batch.batchId}
          batch={batch}
          canPrice={canPrice}
          allowed={allowedCurrencies}
          onConfirm={askConfirm}
          onReject={setRejecting}
        />
      ))}

      <ActionModal
        open={confirming !== null}
        title={t('cost.pending.confirmTitle')}
        okText={t('cost.pending.confirmOk')}
        okDisabled={reading || currencyOutOfList}
        refTexts={{
          currency: listKnown
            ? 'cost.pending.currencyRefused'
            : 'cost.pending.currencyRefusedNoList',
        }}
        onClose={() => setConfirming(null)}
        onSubmit={async () => {
          if (!confirming) return;
          try {
            await confirmBatch(confirming.batch.batchId, {
              effectiveFrom: confirming.date,
              ...(confirming.currency !== undefined && listKnown
                ? { currency: confirming.currency }
                : {}),
            });
          } catch (error) {
            refreshOnConflict(error);
            throw error;
          }
          message.success(t('cost.pending.confirmed'));
          setConfirming(null);
          reload();
        }}
      >
        {confirming ? (
          <Flex vertical gap={8}>
            <Typography.Text strong style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {t('cost.pending.confirmSummary', {
                model: confirming.batch.model,
                currency: confirming.currency ?? confirming.batch.currency,
                date: confirming.date,
              })}
            </Typography.Text>
            <div>{t('cost.pending.consequence.start', { date: confirming.date })}</div>
            <div>{t('cost.pending.consequence.replace')}</div>
            <div>
              {confirming.date <= today
                ? t('cost.pending.consequence.fill', { date: confirming.date })
                : t('cost.pending.consequence.future')}
            </div>
            {!listKnown ? <div>{t('cost.pending.consequence.currency')}</div> : null}
            {currencyOutOfList ? (
              <Typography.Text type="danger">
                {t('cost.pending.currencyNowRefused')}
              </Typography.Text>
            ) : null}
          </Flex>
        ) : null}
      </ActionModal>

      <ReasonModalForm
        open={rejecting !== null}
        title={t('cost.pending.rejectTitle')}
        reasonLabel={t('cost.pending.rejectNote')}
        hint={
          rejectingShown.current ? (
            <BatchSummary
              summary={t('cost.pending.rejectSummary', {
                model: clipCodePoints(plainText(rejectingShown.current.model), 60),
                currency: plainText(rejectingShown.current.currency),
                date: plainText(rejectingShown.current.effectiveFrom),
              })}
              consequence={t('cost.pending.rejectHint')}
            />
          ) : (
            t('cost.pending.rejectHint')
          )
        }
        onClose={() => setRejecting(null)}
        onSubmit={async (note) => {
          if (!rejecting) return;
          try {
            await rejectBatch(rejecting.batchId, note);
          } catch (error) {
            refreshOnConflict(error);
            throw error;
          }
          message.success(t('cost.pending.rejected'));
          setRejecting(null);
          reload();
        }}
      />
    </Flex>
  );
}
