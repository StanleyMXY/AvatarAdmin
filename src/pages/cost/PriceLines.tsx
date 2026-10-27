import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import type { Band, PriceBatch } from '../../services/cost';
import { formatCount } from '../../utils/ratio';
import { labelOf } from './labels';
import { Price } from './WrapText';

type Intl = ReturnType<typeof useIntl>;

/** The input length a band covers: `0 to 32,000`, or `128,001 and above` for the last band. */
export function rangeText(
  intl: Intl,
  band: Pick<Band, 'inputMinTokens' | 'inputMaxTokens'>,
): string {
  const min = formatCount(band.inputMinTokens, intl.locale);
  return band.inputMaxTokens === null
    ? intl.formatMessage({ id: 'cost.prices.band.rangeOpen' }, { min })
    : intl.formatMessage(
        { id: 'cost.prices.band.rangeValue' },
        { min, max: formatCount(band.inputMaxTokens, intl.locale) },
      );
}

/** The price of a batch as it is stored: a line for each band (LLM) or the unit price with its unit. */
export function PriceLines({ batch }: { batch: PriceBatch }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  if (batch.bands === null) {
    return (
      <span>
        <Price value={batch.unitPrice} /> {labelOf(intl, 'cost.unit', batch.unit)}
      </span>
    );
  }
  return (
    <Flex vertical gap={4}>
      {batch.bands.map((band) => (
        <div key={`${band.inputMinTokens}`} style={{ overflowWrap: 'anywhere' }}>
          <Typography.Text strong>{rangeText(intl, band)}</Typography.Text>
          <div>
            {t('cost.prices.price.inputPrice')}: <Price value={band.inputPrice} />
            {' · '}
            {t('cost.prices.price.cachedInputPrice')}: <Price value={band.cachedInputPrice} />
            {' · '}
            {t('cost.prices.price.outputPrice')}: <Price value={band.outputPrice} />
          </div>
        </div>
      ))}
    </Flex>
  );
}
