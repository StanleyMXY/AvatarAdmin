import { useIntl } from '@umijs/max';
import { Input, Typography } from 'antd';
import { useEffect, useRef } from 'react';
import { trimSpec } from '../utils/trimSpec';

/** The parsed value of `text`, or `{ ok: false }` when it is not JSON. */
export function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

type Props = {
  value?: string;
  onChange?: (text: string) => void;
  /** Called with false while the text is not valid JSON, so the parent form can refuse to submit. */
  onValidityChange?: (valid: boolean) => void;
  /** An empty box counts as valid (nothing to send). */
  allowEmpty?: boolean;
  rows?: number;
};

/** A text box for a JSON value: says when the text is not JSON and tells the parent form. */
export function JsonField({ value = '', onChange, onValidityChange, allowEmpty, rows = 6 }: Props) {
  const intl = useIntl();
  const empty = trimSpec(value) === '';
  const valid = empty ? Boolean(allowEmpty) : parseJson(value).ok;
  // The parent often passes a new function on every render: it is called through a ref, so the
  // report is made when the validity changes and not each time the parent draws again.
  const report = useRef(onValidityChange);
  report.current = onValidityChange;
  useEffect(() => {
    report.current?.(valid);
  }, [valid]);
  // A box that is gone cannot hold the form back.
  useEffect(() => () => report.current?.(true), []);
  return (
    <div>
      <Input.TextArea
        rows={rows}
        value={value}
        status={valid ? undefined : 'error'}
        onChange={(event) => onChange?.(event.target.value)}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
      />
      {valid ? null : (
        <Typography.Text type="danger" role="alert">
          {intl.formatMessage({ id: 'pages.json.invalid' })}
        </Typography.Text>
      )}
    </div>
  );
}
