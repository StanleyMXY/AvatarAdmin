import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { ApiError } from '../../request/errors';
import { banUser } from '../../services/users';
import { canBan } from './accountState';
import { actionFailure } from './text';

type Props = {
  accountId: string;
  /** `User.status` of the account as the page knows it: only an active account can be banned. */
  status: string;
  /** Called after the ban, and after a refusal that says the account is not as the page thought (the page reads it again). */
  onDone: () => void;
  /** The small link style used in a table row. */
  compact?: boolean;
};

/**
 * The ban button and its dialog (`USER:BAN`; used by the user detail and the multi-account page).
 * The reason is shown to the user in one language, 1 to 500 characters; the dialog says what a ban
 * does and does not do. The button is disabled for an account that is not active, with the reason.
 */
export function BanUserModal({ accountId, status, onDone, compact }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Set when the ban went through: a second submit while the dialog is closing sends nothing.
  const banned = useRef(false);

  if (!access.canAccess('USER:BAN')) return null;
  const enabled = canBan(status);

  const close = () => {
    setOpen(false);
    setFailure(null);
  };

  const submit = async (reason: string) => {
    if (banned.current) return;
    setFailure(null);
    try {
      await banUser(accountId, reason);
      banned.current = true;
    } catch (error) {
      const text = actionFailure(intl, error);
      setFailure(text);
      if (error instanceof ApiError && error.code === 'INVALID_STATE') {
        // The page reads the account again and may replace this button, so the dialog cannot be
        // the only place that says what the account is now.
        message.error(text);
        onDone();
      }
      return;
    }
    message.success(t('users.ban.done'));
    close();
    onDone();
  };

  return (
    <>
      <Tooltip title={enabled ? undefined : t('users.action.banOnlyActive')}>
        <span>
          <Button
            danger
            type={compact ? 'link' : 'default'}
            size={compact ? 'small' : 'middle'}
            disabled={!enabled}
            onClick={() => {
              banned.current = false;
              setOpen(true);
            }}
          >
            {t('users.action.ban')}
          </Button>
        </span>
      </Tooltip>
      <ReasonModalForm
        open={open}
        title={t('users.ban.title')}
        max={500}
        hint={
          <Flex vertical gap={8} style={{ marginTop: 4 }}>
            <Typography.Text type="secondary">{t('users.ban.hint')}</Typography.Text>
            <Alert type="warning" showIcon title={t('users.ban.consequence')} />
            {failure ? <Alert type="error" showIcon title={failure} /> : null}
          </Flex>
        }
        onSubmit={submit}
        onClose={close}
      />
    </>
  );
}
