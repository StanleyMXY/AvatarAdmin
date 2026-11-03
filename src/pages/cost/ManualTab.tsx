import { useIntl } from '@umijs/max';
import { Alert, App, Button, DatePicker, Flex, Input, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { type Kept, useKeptState } from '../../hooks/useKeptState';
import { ApiError } from '../../request/errors';
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
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { pickedDay, todayUtc } from '../../utils/utcDay';
import { ActionModal } from './ActionModal';
import { type BandField, bandPlace, reasonWords, refusalLine } from './failure';
import { labelOf } from './labels';

type BandDraft = { min: string; max: string; input: string; cached: string; output: string };
const FIRST_BAND: BandDraft = { min: '0', max: '', input: '', cached: '', output: '' };

/** A bound typed as text: nothing is null, whole digits are the number, anything else is NaN (the check names it). */
const parseBound = (text: string): number | null => {
  const t = trimSpec(text);
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
};

/** The field of a band draft, by the name the backend gives the field in `data.details`. */
const BAND_REF: Record<keyof BandDraft, BandField> = {
  min: 'inputMinTokens',
  max: 'inputMaxTokens',
  input: 'inputPrice',
  cached: 'cachedInputPrice',
  output: 'outputPrice',
};

/** The refs of `data.details` that have a place in this form: its own fields and the fields of its bands. */
const FORM_REFS = new Set([
  'resourceType',
  'unit',
  'provider',
  'model',
  'currency',
  'effectiveFrom',
  'unitPrice',
  'bands',
]);

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
  // The backend refused the price field by field: the failure itself (its words are made when the form
  // is drawn, so they follow the language), and the refs whose field was edited since (their hint is gone).
  const [refused, setRefused] = useState<{ error: ApiError } | null>(null);
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const hintId = useId();

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

  // The hints that are up now: the first reason of each ref the backend named whose field was not edited since.
  const refusals = useMemo(() => {
    const byRef = new Map<string, string>();
    for (const detail of refused?.error.details ?? []) {
      if (!edited.has(detail.ref) && !byRef.has(detail.ref)) byRef.set(detail.ref, detail.reason);
    }
    return byRef;
  }, [refused, edited]);
  const hasPlace = (ref: string) => {
    const band = bandPlace(ref);
    return band !== null ? band.index < bands.length : FORM_REFS.has(ref);
  };
  /** The fields that were edited: their hints go (the hints of the other fields stay). */
  const forget = (...refs: string[]) => {
    if (refused === null) return;
    setEdited((before) =>
      refs.every((r) => before.has(r)) ? before : new Set([...before, ...refs]),
    );
  };
  const forgetBands = () =>
    forget(
      ...(refused?.error.details ?? [])
        .map((d) => d.ref)
        .filter((r) => r === 'bands' || bandPlace(r)),
    );
  const forgetAll = () => forget(...(refused?.error.details ?? []).map((d) => d.ref));
  const hint = (ref: string): ReactNode => {
    const reason = refusals.get(ref);
    if (reason === undefined) return null;
    return (
      <Typography.Text
        type="danger"
        id={`${hintId}${ref}`}
        data-testid={`refusal-${ref}`}
        style={{ fontSize: 12, overflowWrap: 'anywhere' }}
      >
        {reasonWords(intl, reason) ?? t('cost.refused.generic')}
      </Typography.Text>
    );
  };
  /** Marks an input as refused and ties its hint to it. */
  const refusedProps = (ref: string) =>
    refusals.has(ref)
      ? ({ status: 'error', 'aria-invalid': true, 'aria-describedby': `${hintId}${ref}` } as const)
      : ({} as const);
  const setBand = (index: number, patch: Partial<BandDraft>) => {
    setBands((list) => list.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    forget(
      ...(Object.keys(patch) as (keyof BandDraft)[]).map((k) => `bands[${index}].${BAND_REF[k]}`),
      'bands',
    );
  };
  const addBand = () => {
    forgetBands();
    setBands((list) => {
      const before = parseBound(list[list.length - 1].max);
      const min = before !== null && Number.isSafeInteger(before) ? String(before + 1) : '';
      return [...list, { min, max: '', input: '', cached: '', output: '' }];
    });
  };

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
    setRefused(null);
    setEdited(new Set());
  };

  // What the backend said about a field this form has no place for, as lines above the form.
  const refusalLines = [
    ...new Set(
      (refused?.error.details ?? [])
        .filter((d) => !edited.has(d.ref) && !hasPlace(d.ref))
        .map((d) => refusalLine(intl, d))
        .filter((line): line is string => line !== null),
    ),
  ];
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
            status={refusals.has('resourceType') ? 'error' : undefined}
            style={{ minWidth: 220 }}
            value={resourceType}
            onChange={(next) => {
              setResourceType(next);
              forgetAll();
            }}
            options={RESOURCE_TYPES.map((r) => ({
              value: r,
              label: labelOf(intl, 'cost.resourceType', r),
            }))}
          />
          {hint('resourceType')}
          {hint('unit')}
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.provider')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.provider')}
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              forget('provider');
            }}
            style={{ width: 240 }}
            {...refusedProps('provider')}
          />
          {hint('provider')}
          {attempted && providerProblem ? (
            <Typography.Text type="danger">{t('cost.manual.invalid.provider')}</Typography.Text>
          ) : null}
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.model')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.model')}
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              forget('model');
            }}
            style={{ width: 240 }}
            {...refusedProps('model')}
          />
          {hint('model')}
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
              status={refusals.has('effectiveFrom') ? 'error' : undefined}
              onChange={(picked) => {
                if (picked) setDate(pickedDay(picked));
                forget('effectiveFrom');
              }}
            />
          </div>
          {hint('effectiveFrom')}
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
            status={refusals.has('currency') ? 'error' : undefined}
            value={currency}
            onChange={(next) => {
              setCurrency(next);
              forget('currency');
            }}
            options={(listKnown ? allowedCurrencies : []).map((c) => ({ value: c, label: c }))}
          />
          {hint('currency')}
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
            const cell = (key: keyof BandDraft, props: React.ComponentProps<typeof Input>) => {
              const ref = `bands[${index}].${BAND_REF[key]}`;
              return (
                // A plain box: twenty bands of five boxes are drawn again at every keystroke.
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 130 }}>
                  <Input
                    value={band[key]}
                    onChange={(e) => setBand(index, { [key]: e.target.value })}
                    style={{ width: 130 }}
                    {...props}
                    {...refusedProps(ref)}
                  />
                  {hint(ref)}
                </div>
              );
            };
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: bands have no identity but their position
              <Flex key={index} gap={8} wrap align="flex-start">
                {cell('min', {
                  'aria-label': t('cost.manual.band.min', { n }),
                  placeholder: t('cost.manual.band.col.min'),
                  inputMode: 'numeric',
                })}
                {cell('max', {
                  'aria-label': t('cost.manual.band.max', { n }),
                  placeholder: last ? t('cost.manual.band.maxHint') : t('cost.manual.band.col.max'),
                  inputMode: 'numeric',
                })}
                {cell('input', {
                  'aria-label': t('cost.manual.band.input', { n }),
                  placeholder: t('cost.manual.band.col.input'),
                  inputMode: 'decimal',
                })}
                {cell('cached', {
                  'aria-label': t('cost.manual.band.cached', { n }),
                  placeholder: t('cost.manual.band.cachedHint'),
                  inputMode: 'decimal',
                })}
                {cell('output', {
                  'aria-label': t('cost.manual.band.output', { n }),
                  placeholder: t('cost.manual.band.col.output'),
                  inputMode: 'decimal',
                })}
                <Button
                  aria-label={t('cost.manual.band.remove', { n })}
                  disabled={bands.length === 1}
                  onClick={() => {
                    forgetBands();
                    setBands((list) => list.filter((_, i) => i !== index));
                  }}
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
          {hint('bands')}
        </Flex>
      ) : (
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.manual.unitPrice')}</Typography.Text>
          <Input
            aria-label={t('cost.manual.unitPrice')}
            value={unitPrice}
            onChange={(e) => {
              setUnitPrice(e.target.value);
              forget('unitPrice');
            }}
            style={{ width: 240 }}
            inputMode="decimal"
            {...refusedProps('unitPrice')}
          />
          {hint('unitPrice')}
        </Flex>
      )}
      {attempted && priceProblem ? (
        <Typography.Text type="danger">{t('cost.manual.invalid.price')}</Typography.Text>
      ) : null}
      {attempted && currency === undefined ? (
        <Typography.Text type="danger">{t('cost.manual.invalid.currency')}</Typography.Text>
      ) : null}

      {refused && refusals.size > 0 ? (
        <Alert
          type="error"
          showIcon
          data-testid="manual-refused"
          title={describeFailure(intl, refused.error).text}
          description={refusalLines.map((line) => <div key={line}>{line}</div>)}
        />
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
          try {
            await createPrice(body());
          } catch (error) {
            // A refusal that names fields goes under the fields, in the form; anything else stays in the dialog.
            if (
              error instanceof ApiError &&
              error.code === 'INVALID_REQUEST' &&
              error.details.length > 0
            ) {
              setRefused({ error });
              setEdited(new Set());
              setConfirming(false);
              return;
            }
            throw error;
          }
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
