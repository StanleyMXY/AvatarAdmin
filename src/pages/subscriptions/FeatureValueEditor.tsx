import { useIntl } from '@umijs/max';
import { Flex, Input, InputNumber, Radio, Switch } from 'antd';
import { useRef } from 'react';
import type { FeatureValue } from '../../services/subscriptions';

export type FeatureValueEditorProps = {
  /** The kind of the switch: a yes/no, a number limit, or a text. */
  type: 'BOOLEAN' | 'LIMIT' | 'STRING';
  value: FeatureValue;
  /** "Not configured" can be picked (an entitlement's switch, and the five quota defaults). */
  allowUnset: boolean;
  /** "No limit" can be picked (a number limit, except the period grant). */
  allowUnlimited: boolean;
  onChange: (value: FeatureValue) => void;
  disabled?: boolean;
  /** Names the control for assistive technology, for example the key of the switch. */
  label?: string;
};

const emptyValue = (type: FeatureValueEditorProps['type']): unknown =>
  type === 'BOOLEAN' ? false : type === 'LIMIT' ? null : '';

/**
 * The editor of one feature value. A value has three states and the three are told apart on the
 * screen, not by an empty box: "not configured" (the entitlement says nothing, so the default
 * applies), "value" (a switch, a number or a text), and "no limit". A state the caller does not
 * allow is not offered, but a value that is already in it is still shown.
 */
export function FeatureValueEditor({
  type,
  value,
  allowUnset,
  allowUnlimited,
  onChange,
  disabled,
  label,
}: FeatureValueEditorProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // The value typed before the person looked at another state comes back with "value".
  const lastValue = useRef<unknown>(value.mode === 'VALUE' ? value.value : emptyValue(type));
  if (value.mode === 'VALUE') lastValue.current = value.value;

  const options = [
    ...(allowUnset || value.mode === 'UNSET'
      ? [{ value: 'UNSET', label: t('subscriptions.value.unset') }]
      : []),
    { value: 'VALUE', label: t('subscriptions.value.value') },
    ...(allowUnlimited || value.mode === 'UNLIMITED'
      ? [{ value: 'UNLIMITED', label: t('subscriptions.value.unlimited') }]
      : []),
  ];

  const pickMode = (mode: FeatureValue['mode']) => {
    if (mode === 'VALUE') onChange({ mode: 'VALUE', value: lastValue.current });
    else onChange({ mode });
  };

  const control = () => {
    if (value.mode !== 'VALUE') return null;
    if (type === 'BOOLEAN') {
      return (
        <Switch
          aria-label={label ? `${label}: ${t('subscriptions.value.value')}` : undefined}
          checked={value.value === true}
          disabled={disabled}
          checkedChildren={t('subscriptions.value.on')}
          unCheckedChildren={t('subscriptions.value.off')}
          onChange={(checked) => onChange({ mode: 'VALUE', value: checked })}
        />
      );
    }
    if (type === 'LIMIT') {
      return (
        <InputNumber
          aria-label={
            label ? `${label}: ${t('subscriptions.value.value')}` : t('subscriptions.value.value')
          }
          min={0}
          precision={0}
          style={{ width: 140 }}
          value={typeof value.value === 'number' ? value.value : null}
          disabled={disabled}
          onChange={(next) => onChange({ mode: 'VALUE', value: next })}
        />
      );
    }
    return (
      <Input
        aria-label={
          label ? `${label}: ${t('subscriptions.value.value')}` : t('subscriptions.value.value')
        }
        style={{ width: 200 }}
        dir="auto"
        value={typeof value.value === 'string' ? value.value : ''}
        disabled={disabled}
        onChange={(event) => onChange({ mode: 'VALUE', value: event.target.value })}
      />
    );
  };

  return (
    <Flex gap={8} align="center" wrap>
      <Radio.Group
        optionType="button"
        size="small"
        aria-label={label}
        options={options}
        value={value.mode}
        disabled={disabled}
        onChange={(event) => pickMode(event.target.value as FeatureValue['mode'])}
      />
      {control()}
    </Flex>
  );
}
