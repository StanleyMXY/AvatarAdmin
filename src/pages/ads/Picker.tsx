import { useIntl } from '@umijs/max';
import { Button, Flex, Select, Typography } from 'antd';
import type { PermissionCode } from '../../access/permissionCodes';
import type { OptionsStatus } from './useOptions';

export type PickerOption = { value: string; label: string; disabled?: boolean };

type Props = {
  /** The accessible name of the selector. */
  label: string;
  status: OptionsStatus;
  options: PickerOption[];
  /** The permission the rows come from: named when a refusal disabled the selector. */
  permission: PermissionCode;
  onRetry?: () => void;
  value?: string;
  onChange?: (value: string | undefined) => void;
  allowClear?: boolean;
  placeholder?: string;
  disabled?: boolean;
  width?: number | string;
};

/**
 * A selector over rows that another permission reads (the campaigns, the placements, the units).
 * When the backend refuses the read for lack of that permission, the selector is disabled and says
 * which permission it needs; any other failure says so and offers a retry.
 */
export function Picker({
  label,
  status,
  options,
  permission,
  onRetry,
  value,
  onChange,
  allowClear,
  placeholder,
  disabled,
  width = 240,
}: Props) {
  const intl = useIntl();
  return (
    <Flex vertical gap={2} style={{ width }}>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ width: '100%' }}
        aria-label={label}
        placeholder={placeholder ?? label}
        allowClear={allowClear}
        loading={status === 'loading'}
        disabled={disabled || status === 'forbidden'}
        options={options}
        value={value}
        onChange={(next) => onChange?.(next)}
      />
      {status === 'forbidden' ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {intl.formatMessage({ id: 'ads.common.needsPermission' }, { code: permission })}
        </Typography.Text>
      ) : null}
      {status === 'failed' ? (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          {intl.formatMessage({ id: 'ads.common.optionsFailed' })}{' '}
          {onRetry ? (
            <Button type="link" size="small" onClick={onRetry} style={{ padding: 0 }}>
              {intl.formatMessage({ id: 'pages.common.retry' })}
            </Button>
          ) : null}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}
