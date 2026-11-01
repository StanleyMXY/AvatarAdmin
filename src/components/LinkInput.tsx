import { useIntl } from '@umijs/max';
import { Form, Input, Typography } from 'antd';
import type { Rule } from 'antd/es/form';
import { useState } from 'react';
import { type LinkReasonKey, validateServerLink } from '../utils/linkRule';

type Translate = { formatMessage: (d: { id: string }) => string };

const reasonText = (intl: Translate, key: LinkReasonKey) =>
  intl.formatMessage({ id: `reason.${key}` });

/**
 * A rule for `Form.Item`: the link rule of contract 1.7. An empty value passes unless `required`
 * (the field is then checked like any other value, so the form cannot be submitted empty).
 */
export function linkRule(
  intl: Translate,
  opts: { maxLength?: number; required?: boolean } = {},
): Rule {
  return {
    validator: async (_, value: string | undefined) => {
      const text = value ?? '';
      if (text === '' && !opts.required) return;
      const check = validateServerLink(text, { maxLength: opts.maxLength });
      if (!check.ok) throw new Error(reasonText(intl, check.reasonKey));
    },
  };
}

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
  /** False when a `Form.Item` with `linkRule` already shows the message. */
  showError?: boolean;
  disabled?: boolean;
};

/** An input for a link the server will hand out; says what is wrong with it in the current language. */
export function LinkInput({
  value = '',
  onChange,
  maxLength,
  required,
  placeholder,
  showError = true,
  disabled,
}: Props) {
  const intl = useIntl();
  // An empty required box is not marked before the person has typed in it or left it.
  const [touched, setTouched] = useState(false);
  // A form that refused the box (a send pressed with the box empty) counts as having been there:
  // a rule that stays quiet because this box says the reason must not leave it unsaid.
  const { status } = Form.Item.useStatus();
  const check =
    value === '' && (!required || !(touched || status === 'error'))
      ? ({ ok: true } as const)
      : validateServerLink(value, { maxLength });
  return (
    <div>
      <Input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        status={check.ok ? undefined : 'error'}
        onChange={(event) => {
          setTouched(true);
          onChange?.(event.target.value);
        }}
        onBlur={() => setTouched(true)}
        inputMode="url"
        spellCheck={false}
      />
      {showError && !check.ok ? (
        <Typography.Text type="danger" role="alert">
          {reasonText(intl, check.reasonKey)}
        </Typography.Text>
      ) : null}
    </div>
  );
}
