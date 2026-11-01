import { useIntl } from '@umijs/max';
import { Button, Popconfirm } from 'antd';
import type { ReactNode } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight';

type Props = {
  /** The question asked before the action, for example "Delete this rule?". */
  confirmText: string;
  /** Does the action. It shows its own error (a message at the top); a rejection is not shown here. */
  onConfirm: () => Promise<void>;
  /** The label of the button that opens the question. */
  children: ReactNode;
  disabled?: boolean;
};

/**
 * A row action that is dangerous (delete, cancel, retry): asks inline first, and while the action
 * runs the confirmation button is disabled and pressing it again does nothing.
 */
export function DangerConfirmButton({ confirmText, onConfirm, children, disabled }: Props) {
  const intl = useIntl();
  const { run, pending } = useSingleFlight(onConfirm);
  return (
    <Popconfirm
      title={
        // The bubble is as wide as its text up to the window; a long question wraps here instead.
        <span
          style={{
            display: 'inline-block',
            maxWidth: 'min(360px, 80vw)',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          {confirmText}
        </span>
      }
      okText={intl.formatMessage({ id: 'pages.common.ok' })}
      cancelText={intl.formatMessage({ id: 'pages.common.cancel' })}
      okButtonProps={{ danger: true, loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onConfirm={async () => {
        try {
          await run();
        } catch {
          // the action reports its own failure; the button only has to become usable again
        }
      }}
      disabled={disabled || pending}
    >
      <Button type="link" danger size="small" disabled={disabled || pending}>
        {children}
      </Button>
    </Popconfirm>
  );
}
