import { useIntl } from '@umijs/max';
import { Alert, App, Button, DatePicker, Flex, Input, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { type Kept, useKeptState } from '../../hooks/useKeptState';
import { listConfig } from '../../services/config';
import {
  createPrice,
  isValidPrice,
  type NewBand,
  type NewPrice,
  RESOURCE_TYPES,
  UNIT_OF,
  validateBands,
} from '../../services/cost';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { pickedDay, todayUtc } from '../../utils/utcDay';
import { ActionModal } from './ActionModal';
import { labelOf } from './labels';

type BandDraft = { min: string; max: string; input: string; cached: string; output: string };
const FIRST_BAND: BandDraft = { min: '0', max: '', input: '', cached: '', output: '' };

/** A bound typed as text: nothing is null, whole digits are the number, anything else is NaN (the check names it). */
const parseBound = (text: string): number | null => {
  const t = trimSpec(text);
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
};

const validName = (text: string) => {
  const n = countCodePoints(trimSpec(text));
  return n >= 1 && n <= 128;
};

type Props = {
  allowedCurrencies: string[] | null | undefined;
  /** Called after a batch was saved. */
  onSaved: () => void;
  /** The form is drawn again each time the tab is opened; what was typed is kept here until it is saved. */
  kept: Kept;
};

/**
 * 手填价格 (`COST:PRICE`): a form that adds a new batch, in force at once. An LLM price has bands that
 * are checked while typing (`validateBands`); the other types have one unit price and a unit that
 * the type decides. Prices are sent as the text typed, never as numbers. Saving says what it does
 * first; a saved batch is never edited, a new one is entered instead.
 */
export function ManualTab({ allowedCurrencies, onSaved, kept }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const listKnown = Array.isArray(allowedCurrencies);

  const [resourceType, setResourceType] = useKeptState<string>(kept, 'manual.resourceType', 'LLM');
  const [provider, setProvider] = useKeptState(kept, 'manual.provider', '');
  const [model, setModel] = useKeptState(kept, 'manual.model', '');
  const [date, setDate] = useKeptState(kept, 'manual.date', () => todayUtc());
  const [currency, setCurrency] = useKeptState<string | undefined>(kept, 'manual.currency', () =>
    listKnown ? allowedCurrencies[0] : undefined,
  );
  const [unitPrice, setUnitPrice] = useKeptState(kept, 'manual.unitPrice', '');
  const [bands, setBands] = useKeptState<BandDraft[]>(kept, 'manual.bands', [FIRST_BAND]);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [maxBands, setMaxBands] = useState<number | null>(null);

  // The limit on the number of bands is a parameter of this page (`usage_price.max_bands`); without it nothing is limited here.
  useEffect(() => {
    let alive = true;
    listConfig()
      .then(({ items }) => {
        const value = items.find((item) => item.key === 'usage_price.max_bands')?.value;
        if (alive && typeof value === 'number' && Number.isInteger(value) && value > 0)
          setMaxBands(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // If the list of currencies arrives after the form was drawn, start with its first one.
  useEffect(() => {
    if (listKnown && currency === undefined) setCurrency(allowedCurrencies[0]);
  }, [listKnown, allowedCurrencies, currency, setCurrency]);

  const llm = resourceType === 'LLM';
  const unit = UNIT_OF[resourceType as keyof typeof UNIT_OF];
  const verdict = useMemo(
    () =>
      validateBands(
        bands.map((b) => ({
          inputMinTokens: parseBound(b.min),
          inputMaxTokens: parseBound(b.max),
        })),
      ),
    [bands],
  );
  const bandsProblem = llm && !verdict.ok ? verdict.reasonKey : null;

  const prices = llm
    ? bands
        .flatMap((b) => [b.input, b.output, ...(trimSpec(b.cached) === '' ? [] : [b.cached])])
        .map(trimSpec)
    : [trimSpec(unitPrice)];
  const priceProblem = prices.some((p) => !isValidPrice(p));
  const providerProblem = !validName(provider);
  const modelProblem = !validName(model);
  const anyProblem =
    providerProblem ||
    modelProblem ||
    priceProblem ||
    bandsProblem !== null ||
    currency === undefined;

  const setBand = (index: number, patch: Partial<BandDraft>) =>
    setBands((list) => list.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const addBand = () =>
    setBands((list) => {
      const before = parseBound(list[list.length - 1].max);
      const min = before !== null && Number.isSafeInteger(before) ? String(before + 1) : '';
      return [...list, { min, max: '', input: '', cached: '', output: '' }];
    });

  const body = (): NewPrice => {
    const common = {
      resourceType,
      provider: trimSpec(provider),
      model: trimSpec(model),
      unit,
      effectiveFrom: date,
      currency: currency as string,
    };
    if (!llm) return { ...common, unitPrice: trimSpec(unitPrice) };
    const sent: NewBand[] = bands.map((b) => ({
      inputMinTokens: parseBound(b.min) as number,
      inputMaxTokens: parseBound(b.max),
      inputPrice: trimSpec(b.input),
      cachedInputPrice: trimSpec(b.cached) === '' ? null : trimSpec(b.cached),
      outputPrice: trimSpec(b.output),
    }));
    return { ...common, bands: sent };
  };

  const reset = () => {
    setProvider('');
    setModel('');
    setUnitPrice('');
    setBands([FIRST_BAND]);
    setAttempted(false);
  };

  const canAdd = maxBands === null || bands.length < maxBands;
  const today = todayUtc();

  return (
    <Flex vertical gap={12} style={{ maxWidth: 960 }}>
      <Alert type="info" showIcon data-testid="manual-note" title={t('cost.manual.note')} />
      <Flex gap={16} wrap>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.resourceType')}</Typography.Text>
          <Select
            aria-label={t('cost.manual.resourceType')}
            style={{ minWidth: 220 }}
            value={resourceType}
            onChange={setResourceType}
            options={RESOURCE_TYPES.map((r) => ({
              value: r,
              label: labelOf(intl, 'cost.resourceType', r),
            }))}
          />
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.provider')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.provider')}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{ width: 240 }}
          />
          {attempted && providerProblem ? (
            <Typography.Text type="danger">{t('cost.manual.invalid.provider')}</Typography.Text>
          ) : null}
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.model')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.model')}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ width: 240 }}
          />
          {attempted && modelProblem ? (
            <Typography.Text type="danger">{t('cost.manual.invalid.model')}</Typography.Text>
          ) : null}
        </Flex>
      </Flex>
      <Flex gap={16} wrap>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.effectiveFrom')}</Typography.Text>
          <div data-testid="manual-date">
            <DatePicker
              allowClear={false}
              value={dayjs(`${date}T00:00:00`)}
              onChange={(picked) => picked && setDate(pickedDay(picked))}
            />
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('cost.manual.effectiveFromHint')}
          </Typography.Text>
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.currency')}</Typography.Text>
          <Select
            aria-label={t('cost.manual.currency')}
            style={{ minWidth: 140 }}
            disabled={!listKnown}
            value={currency}
            onChange={setCurrency}
            options={(listKnown ? allowedCurrencies : []).map((c) => ({ value: c, label: c }))}
          />
          {!listKnown ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              {t('cost.manual.currencyMissing')}
            </Typography.Text>
          ) : null}
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.unit')}</Typography.Text>
          <Typography.Text data-testid="manual-unit" strong>
            {labelOf(intl, 'cost.unit', unit)}
          </Typography.Text>
        </Flex>
      </Flex>

      {llm ? (
        <Flex vertical gap={8}>
          <Typography.Text strong>{t('cost.manual.bands')}</Typography.Text>
          <Typography.Text type="secondary">
            {t('cost.prices.price.perMillion')} {t('cost.prices.price.cachedEmpty')}
            {maxBands !== null ? ` ${t('cost.manual.band.limit', { max: maxBands })}` : ''}
          </Typography.Text>
          {bands.map((band, index) => {
            const n = index + 1;
            const last = index === bands.length - 1;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: bands have no identity but their position
              <Flex key={index} gap={8} wrap align="flex-end">
                <Input
                  aria-label={t('cost.manual.band.min', { n })}
                  placeholder={t('cost.manual.band.col.min')}
                  value={band.min}
                  onChange={(e) => setBand(index, { min: e.target.value })}
                  style={{ width: 130 }}
                  inputMode="numeric"
                />
                <Input
                  aria-label={t('cost.manual.band.max', { n })}
                  placeholder={last ? t('cost.manual.band.maxHint') : t('cost.manual.band.col.max')}
                  value={band.max}
                  onChange={(e) => setBand(index, { max: e.target.value })}
                  style={{ width: 130 }}
                  inputMode="numeric"
                />
                <Input
                  aria-label={t('cost.manual.band.input', { n })}
                  placeholder={t('cost.manual.band.col.input')}
                  value={band.input}
                  onChange={(e) => setBand(index, { input: e.target.value })}
                  style={{ width: 130 }}
                  inputMode="decimal"
                />
                <Input
                  aria-label={t('cost.manual.band.cached', { n })}
                  placeholder={t('cost.manual.band.cachedHint')}
                  value={band.cached}
                  onChange={(e) => setBand(index, { cached: e.target.value })}
                  style={{ width: 130 }}
                  inputMode="decimal"
                />
                <Input
                  aria-label={t('cost.manual.band.output', { n })}
                  placeholder={t('cost.manual.band.col.output')}
                  value={band.output}
                  onChange={(e) => setBand(index, { output: e.target.value })}
                  style={{ width: 130 }}
                  inputMode="decimal"
                />
                <Button
                  aria-label={t('cost.manual.band.remove', { n })}
                  disabled={bands.length === 1}
                  onClick={() => setBands((list) => list.filter((_, i) => i !== index))}
                >
                  −
                </Button>
              </Flex>
            );
          })}
          <Flex gap={8} align="center">
            <Button onClick={addBand} disabled={!canAdd}>
              {t('cost.manual.band.add')}
            </Button>
          </Flex>
          {bandsProblem ? (
            <Typography.Text type="danger" data-testid="bands-problem">
              {t(bandsProblem)}
            </Typography.Text>
          ) : null}
        </Flex>
      ) : (
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.unitPrice')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.unitPrice')}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            style={{ width: 240 }}
            inputMode="decimal"
          />
        </Flex>
      )}
      {attempted && priceProblem ? (
        <Typography.Text type="danger">{t('cost.manual.invalid.price')}</Typography.Text>
      ) : null}
      {attempted && currency === undefined ? (
        <Typography.Text type="danger">{t('cost.manual.invalid.currency')}</Typography.Text>
      ) : null}

      <div>
        <Button
          type="primary"
          disabled={!listKnown || bandsProblem !== null}
          onClick={() => {
            setAttempted(true);
            if (!anyProblem) setConfirming(true);
          }}
        >
          {t('cost.manual.save')}
        </Button>
      </div>

      <ActionModal
        open={confirming}
        title={t('cost.manual.confirmTitle')}
        okText={t('cost.manual.save')}
        onClose={() => setConfirming(false)}
        onSubmit={async () => {
          await createPrice(body());
          message.success(t('cost.manual.saved'));
          setConfirming(false);
          reset();
          onSaved();
        }}
      >
        <Flex vertical gap={8}>
          <Typography.Text strong style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {t('cost.manual.confirmSummary', {
              model: trimSpec(model),
              currency: currency ?? '',
              date,
            })}
          </Typography.Text>
          <div>{t('cost.manual.consequence.active')}</div>
          <div>{t('cost.manual.consequence.replace')}</div>
          <div>
            {date <= today
              ? t('cost.manual.consequence.fill')
              : t('cost.manual.consequence.future')}
          </div>
        </Flex>
      </ActionModal>
    </Flex>
  );
}
