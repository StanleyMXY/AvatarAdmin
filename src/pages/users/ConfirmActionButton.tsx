import { useIntl } from '@umijs/max';
import { Button, Popconfirm, Tooltip } from 'antd';
import { useSingleFlight } from '../../hooks/useSingleFlight';

type Props = {
  label: string;
  /** The question asked inline before the action. */
  confirmText: string;
  /** Why the button is disabled, when it is. */
  disabledReason?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Does the action and shows its own failure; a rejection is not shown here. */
  onConfirm: () => Promise<void>;
};

/**
 * A button of the detail page's header that asks inline first (`Popconfirm`, the confirm button in
 * the danger colour). While the action runs a second press sends nothing.
 */
export function ConfirmActionButton({
  label,
  confirmText,
  disabledReason,
  disabled,
  danger,
  onConfirm,
}: Props) {
  const intl = useIntl();
  const { run, pending } = useSingleFlight(onConfirm);
  return (
    <Tooltip title={disabled ? disabledReason : undefined}>
      <span>
        <Popconfirm
          title={confirmText}
          okText={intl.formatMessage({ id: 'pages.common.ok' })}
          cancelText={intl.formatMessage({ id: 'pages.common.cancel' })}
          okButtonProps={{ danger: true, loading: pending, disabled: pending }}
          cancelButtonProps={{ disabled: pending }}
          disabled={disabled || pending}
          onConfirm={async () => {
            try {
              await run();
            } catch {
              // the action shows its own failure
            }
          }}
        >
          <Button danger={danger} disabled={disabled || pending}>
            {label}
          </Button>
        </Popconfirm>
      </span>
    </Tooltip>
  );
}
