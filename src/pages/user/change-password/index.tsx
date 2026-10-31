import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex } from 'antd';
import { ChangePasswordForm } from '../../../components/layout/ChangePasswordForm';
import { SessionGate } from '../../../session/SessionGate';
import { useSession } from '../../../session/useSession';
import { AuthFrame } from '../AuthFrame';

/**
 * The page an account lands on when its password must be changed first; nothing else is open to it
 * except signing out, so a person who cannot change the password now is not stuck.
 */
export default function ChangePasswordPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const { me, finishPasswordChange, signOut } = useSession();
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
        <Flex justify="center" style={{ marginTop: 12 }}>
          <Button type="link" onClick={signOut}>
            {intl.formatMessage({ id: 'pages.header.logout' })}
          </Button>
        </Flex>
      </AuthFrame>
    </SessionGate>
  );
}
