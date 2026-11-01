import { useIntl } from '@umijs/max';
import { App, Switch } from 'antd';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { describeFailure } from '../session/describe';

type Props = {
  checked: boolean;
  /** For a screen reader: which row the switch belongs to. */
  label: string;
  /** Sends the new state. */
  onToggle: (enabled: boolean) => Promise<unknown>;
  /** The words of a failure; without it, the words of the error code. */
  failureText?: (error: unknown, enabled: boolean) => string;
  /** The list is read again when the request has ended, whatever the answer was. */
  onDone: () => void;
  disabled?: boolean;
};

/**
 * An on/off switch in a row: one request per change and no question asked, and the row is read
 * again afterwards so that it shows what the backend holds. A failure is shown in the words of its
 * error code, never in the backend's own words.
 */
export function EnabledSwitch({ checked, label, onToggle, failureText, onDone, disabled }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { run, pending } = useSingleFlight(async (next: boolean) => {
    try {
      await onToggle(next);
    } catch (error) {
      message.error(failureText ? failureText(error, next) : describeFailure(intl, error).text);
    }
    onDone();
  });
  return (
    <Switch
      checked={checked}
      loading={pending}
      disabled={disabled}
      aria-label={label}
      onChange={(next) => void run(next).catch(() => {})}
    />
  );
}
