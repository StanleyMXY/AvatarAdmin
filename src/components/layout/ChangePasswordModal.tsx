import { useIntl } from '@umijs/max';
import { App, Modal } from 'antd';
import { useSession } from '../../session/useSession';
import { ChangePasswordForm } from './ChangePasswordForm';

/** The change-password dialog of the header menu. After a change the person signs in again. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { me, finishPasswordChange } = useSession();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      mask={{ closable: false }}
      title={intl.formatMessage({ id: 'auth.password.title' })}
    >
      <ChangePasswordForm
        username={me?.username}
        minLength={me?.passwordMinLength}
        onCancel={onClose}
        onDone={() => {
          message.success(intl.formatMessage({ id: 'auth.password.done' }));
          onClose();
          finishPasswordChange();
        }}
      />
    </Modal>
  );
}
