import { useAccess, useIntl } from '@umijs/max';
import { App, Flex } from 'antd';
import { ApiError } from '../../request/errors';
import { cancelDeletion, unbanUser } from '../../services/users';
import { canCancelDeletion, canUnban } from './accountState';
import { BanUserModal } from './BanUserModal';
import { ConfirmActionButton } from './ConfirmActionButton';
import { StartDeletionModal } from './StartDeletionModal';
import { actionFailure } from './text';

type Props = {
  accountId: string;
  status: string;
  /** The account changed (or the backend says it is not as the page thought): the page reads it again. */
  onChanged: () => void;
};

/**
 * The write buttons of the detail page: ban or unban (`USER:BAN`), start or cancel a deletion
 * (`USER:DELETION`). Which of them exist and which are disabled follows the operation matrix of the
 * account states (accountState.ts); a refusal of the backend says the current state in words.
 */
export function AccountActions({ accountId, status, onChanged }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string) => intl.formatMessage({ id });

  const act = (call: () => Promise<unknown>, done: string) => async () => {
    try {
      await call();
    } catch (error) {
      message.error(actionFailure(intl, error));
      if (error instanceof ApiError && error.code === 'INVALID_STATE') onChanged();
      return;
    }
    message.success(t(done));
    onChanged();
  };

  return (
    <Flex gap={8} wrap>
      {status === 'BANNED' ? (
        access.canAccess('USER:BAN') ? (
          <ConfirmActionButton
            label={t('users.action.unban')}
            confirmText={t('users.unban.confirm')}
            disabled={!canUnban(status)}
            onConfirm={act(() => unbanUser(accountId), 'users.unban.done')}
          />
        ) : null
      ) : (
        <BanUserModal accountId={accountId} status={status} onDone={onChanged} />
      )}
      <StartDeletionModal accountId={accountId} status={status} onDone={onChanged} />
      {access.canAccess('USER:DELETION') ? (
        <ConfirmActionButton
          label={t('users.action.cancelDeletion')}
          confirmText={t('users.deletion.cancelConfirm')}
          disabled={!canCancelDeletion(status)}
          disabledReason={t('users.action.cancelDeletionOnly')}
          onConfirm={act(() => cancelDeletion(accountId), 'users.deletion.canceled')}
        />
      ) : null}
    </Flex>
  );
}
