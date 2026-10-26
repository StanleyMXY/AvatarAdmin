import { useIntl } from '@umijs/max';
import { Alert, App } from 'antd';
import { ChangePasswordForm } from '../../../components/layout/ChangePasswordForm';
import { SessionGate } from '../../../session/SessionGate';
import { useSession } from '../../../session/useSession';
import { AuthFrame } from '../AuthFrame';

/** The page an account lands on when its password must be changed first; nothing else is open to it. */
export default function ChangePasswordPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const { me, finishPasswordChange } = useSession();
  return (
    <SessionGate>
      <AuthFrame titleId="auth.password.title">
        <Alert
          type="info"
          showIcon
          title={intl.formatMessage({ id: 'auth.password.forcedNotice' })}
          style={{ marginBottom: 16 }}
        />
        <ChangePasswordForm
          username={me?.username}
          minLength={me?.passwordMinLength}
          onDone={() => {
            message.success(intl.formatMessage({ id: 'auth.password.done' }));
            finishPasswordChange();
          }}
        />
      </AuthFrame>
    </SessionGate>
  );
}
