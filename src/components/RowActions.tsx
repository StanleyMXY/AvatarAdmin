import { useIntl } from '@umijs/max';
import { App, Button, Dropdown, Space } from 'antd';
import { type ReactNode, useRef } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { DangerConfirmButton } from './DangerConfirmButton';

export type RowAction = {
  key: string;
  label: ReactNode;
  onClick: () => void | Promise<void>;
  /** A question to ask first; it makes the action dangerous (red, asked inline). */
  confirmText?: string;
  disabled?: boolean;
};

/** Up to this many actions are shown in the row; more than this, the first `MAX_INLINE - 1` and "More". */
export const MAX_INLINE = 3;

function InlineAction({ action }: { action: RowAction }) {
  const { run, pending } = useSingleFlight(async () => {
    await action.onClick();
  });
  if (action.confirmText) {
    return (
      <DangerConfirmButton
        confirmText={action.confirmText}
        onConfirm={async () => {
          await action.onClick();
        }}
        disabled={action.disabled}
      >
        {action.label}
      </DangerConfirmButton>
    );
  }
  return (
    <Button
      type="link"
      size="small"
      disabled={action.disabled || pending}
      onClick={() => void run().catch(() => {})}
    >
      {action.label}
    </Button>
  );
}

/**
 * The actions of a table row (spec 4.3): three or fewer are all shown; with four or more the first
 * two are shown and the rest go under "More". A dangerous action asks first, inline in the row
 * and as a dialog from the menu. Actions the administrator may not do are left out by the caller.
 */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const intl = useIntl();
  const { modal } = App.useApp();
  // Actions chosen from the menu that are still running: choosing one again does nothing.
  const running = useRef(new Set<string>());
  if (actions.length === 0) return null;
  const inline = actions.length <= MAX_INLINE ? actions : actions.slice(0, MAX_INLINE - 1);
  const rest = actions.length <= MAX_INLINE ? [] : actions.slice(MAX_INLINE - 1);

  const runOnce = async (action: RowAction) => {
    if (running.current.has(action.key)) return;
    running.current.add(action.key);
    try {
      await action.onClick();
    } catch {
      // the action shows its own failure
    } finally {
      running.current.delete(action.key);
    }
  };

  const fromMenu = (action: RowAction) => {
    if (action.confirmText) {
      modal.confirm({
        title: action.confirmText,
        okButtonProps: { danger: true },
        okText: intl.formatMessage({ id: 'pages.common.ok' }),
        cancelText: intl.formatMessage({ id: 'pages.common.cancel' }),
        onOk: async () => {
          await runOnce(action);
        },
      });
      return;
    }
    void runOnce(action);
  };

  return (
    <Space size={0} wrap={false}>
      {inline.map((action) => (
        <InlineAction key={action.key} action={action} />
      ))}
      {rest.length > 0 ? (
        <Dropdown
          trigger={['click']}
          menu={{
            items: rest.map((action) => ({
              key: action.key,
              label: action.label,
              danger: Boolean(action.confirmText),
              disabled: action.disabled,
              onClick: () => fromMenu(action),
            })),
          }}
        >
          <Button type="link" size="small">
            {intl.formatMessage({ id: 'pages.common.more' })}
          </Button>
        </Dropdown>
      ) : null}
    </Space>
  );
}
