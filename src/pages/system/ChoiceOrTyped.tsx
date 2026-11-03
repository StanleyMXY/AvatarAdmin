import { Flex, Input, Select } from 'antd';
import { useState } from 'react';

/** The value of the last option, "Other": it is never sent, it only opens the box to type in. */
const OTHER = '\u0001other';

type Props = {
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** The values to choose from, with the words to show. */
  options: { value: string; label: string }[];
  /** The options are being read. */
  loading?: boolean;
  /** The options could not be read: only the box to type in is drawn. */
  unavailable?: boolean;
  /** The name of the choice, for assistive technology. */
  label: string;
  /** The name of the box to type in that "Other" opens. */
  typedLabel: string;
  /** The name of the box when it is all there is (the options could not be read); the choice's own name by default. */
  unavailableLabel?: string;
  placeholder?: string;
  /** The words of the option that opens the box to type in. */
  otherText: string;
  /** The most the box takes: the backend answers longer text with 400. */
  maxLength: number;
};

/**
 * A filter that is a choice from the values the backend knows, with one more option, "Other", that
 * opens a box to type in: the backend can drop a value (an old action name, an administrator who was
 * deleted) and the rows written with it are still in the log. A value that came with the page and is
 * not among the options (a search that was kept) is shown in the box. The value is sent as it is,
 * case included. When the options cannot be read only the box is drawn, as the page did before it had
 * a list to choose from.
 */
export function ChoiceOrTyped({
  value,
  onChange,
  options,
  loading = false,
  unavailable = false,
  label,
  typedLabel,
  unavailableLabel,
  placeholder,
  otherText,
  maxLength,
}: Props) {
  const [typing, setTyping] = useState(false);
  const current = value ?? '';
  const known = options.some((option) => option.value === current);
  // A value the list does not have is typed text, once the list is there to say so.
  const asText = unavailable || typing || (current !== '' && !loading && !known);

  const box = (
    <Input
      aria-label={unavailable ? (unavailableLabel ?? label) : typedLabel}
      value={current}
      maxLength={maxLength}
      allowClear
      dir="ltr"
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
  if (unavailable) return box;
  return (
    <Flex vertical gap={4}>
      <Select
        aria-label={label}
        showSearch
        allowClear
        optionFilterProp="label"
        value={asText ? OTHER : current === '' ? undefined : current}
        loading={loading}
        placeholder={placeholder}
        options={[
          ...options.map((option) => ({ value: option.value, label: option.label })),
          { value: OTHER, label: otherText },
        ]}
        onChange={(next) => {
          if (next === OTHER) {
            setTyping(true);
            onChange?.(undefined);
            return;
          }
          setTyping(false);
          onChange?.(next);
        }}
        onClear={() => {
          setTyping(false);
          onChange?.(undefined);
        }}
      />
      {asText ? box : null}
    </Flex>
  );
}
