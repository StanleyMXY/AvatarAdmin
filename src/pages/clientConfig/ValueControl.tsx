import { useIntl } from '@umijs/max';
import { Flex, Input, InputNumber, Switch } from 'antd';

type Props = {
  type: string;
  value: unknown;
  label: string;
  error: boolean;
  onChange: (value: unknown) => void;
};

/** The control of a type: a box for a link, an address or a text, a switch, a number box. */
export function ValueControl({ type, value, label, error, onChange }: Props) {
  const intl = useIntl();
  const status = error ? ('error' as const) : undefined;
  if (type === 'BOOLEAN') {
    return (
      <Flex align="center" gap={8}>
        <Switch aria-label={label} checked={value === true} onChange={onChange} />
        <span>
          {intl.formatMessage({
            id: value === true ? 'clientConfig.editor.valueOn' : 'clientConfig.editor.valueOff',
          })}
        </span>
      </Flex>
    );
  }
  if (type === 'INT') {
    return (
      <InputNumber<number>
        aria-label={label}
        style={{ width: 240 }}
        status={status}
        value={typeof value === 'number' ? value : null}
        onChange={(next) => onChange(next)}
      />
    );
  }
  const text = typeof value === 'string' ? value : '';
  if (type === 'STRING') {
    return (
      <Input.TextArea
        aria-label={label}
        dir="auto"
        status={status}
        autoSize={{ minRows: 2, maxRows: 8 }}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Input
      aria-label={label}
      dir="ltr"
      spellCheck={false}
      status={status}
      placeholder={
        type === 'URL'
          ? intl.formatMessage({ id: 'clientConfig.editor.urlPlaceholder' })
          : undefined
      }
      value={text}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
