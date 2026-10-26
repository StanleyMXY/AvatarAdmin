import { useIntl } from '@umijs/max';
import { Tag, Typography } from 'antd';
import type { EffectiveFeature, FeatureKind, FeatureMode } from '../../services/subscriptions';
import { formatCount } from '../../utils/ratio';

type Props = {
  kind: FeatureKind;
  mode: FeatureMode;
  value: unknown;
};

/**
 * A feature value for reading: the number, the text or on/off for a value; "No limit" and
 * "Not configured" each look different from a value and from each other, and a missing value is
 * never shown as 0.
 */
export function FeatureValueText({ kind, mode, value }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  if (mode === 'UNSET')
    return (
      <Typography.Text type="secondary" italic>
        {t('subscriptions.value.unset')}
      </Typography.Text>
    );
  if (mode === 'UNLIMITED') return <Tag color="blue">{t('subscriptions.value.unlimited')}</Tag>;
  if (kind === 'BOOLEAN')
    return <span>{t(value === true ? 'subscriptions.value.on' : 'subscriptions.value.off')}</span>;
  if (kind === 'LIMIT')
    return <span>{typeof value === 'number' ? formatCount(value, intl.locale) : '—'}</span>;
  return (
    <span dir="auto" style={{ overflowWrap: 'anywhere' }}>
      {typeof value === 'string' && value !== '' ? value : '—'}
    </span>
  );
}

export const effectiveSourceKey = (source: EffectiveFeature['source']): string =>
  `subscriptions.source.${source}`;
