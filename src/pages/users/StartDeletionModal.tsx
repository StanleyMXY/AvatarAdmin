import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { ApiError } from '../../request/errors';
import { startDeletion } from '../../services/users';
import { canStartDeletion } from './accountState';
import { actionFailure } from './text';

type Props = {
  accountId: string;
  /** `User.status` as the page knows it: a deletion can start for an active or a banned account only. */
  status: string;
  /** Called after the deletion was scheduled, and after a refusal that says the account is not as the page thought. */
  onDone: () => void;
};

/**
 * The "start deletion" button and its dialog (`USER:DELETION`). It does what the user can do for
 * themselves: the account waits in a grace period and nothing is deleted at once. The reason is
 * 1 to 200 characters and goes to the audit log only.
 */
export function StartDeletionModal({ accountId, status, onDone }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Set when the deletion was scheduled: a second submit while the dialog is closing sends nothing.
  const started = useRef(false);

  if (!access.canAccess('USER:DELETION')) return null;
  const enabled = canStartDeletion(status);

  const close = () => {
    setOpen(false);
    setFailure(null);
  };

  const submit = async (reason: string) => {
    if (started.current) return;
    setFailure(null);
    try {
      await startDeletion(accountId, reason);
      started.current = true;
    } catch (error) {
      setFailure(actionFailure(intl, error));
      if (error instanceof ApiError && error.code === 'INVALID_STATE') onDone();
      return;
    }
    message.success(t('users.deletion.started'));
    close();
    onDone();
  };

  return (
    <>
      <Tooltip title={enabled ? undefined : t('users.action.startDeletionBlocked')}>
        <span>
          <Button
            danger
            disabled={!enabled}
            onClick={() => {
              started.current = false;
              setOpen(true);
            }}
          >
            {t('users.action.startDeletion')}
          </Button>
        </span>
      </Tooltip>
      <ReasonModalForm
        open={open}
        title={t('users.deletion.title')}
        max={200}
        hint={
          <Flex vertical gap={8} style={{ marginTop: 4 }}>
            <Typography.Text type="secondary">{t('users.deletion.reasonNote')}</Typography.Text>
            <Alert type="warning" showIcon title={t('users.deletion.hint')} />
            {failure ? <Alert type="error" showIcon title={failure} /> : null}
          </Flex>
        }
        onSubmit={submit}
        onClose={close}
      />
    </>
  );
}
