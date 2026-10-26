import { history, useIntl, useLocation } from '@umijs/max';
import { Alert, Button, Form, Input } from 'antd';
import { useRef, useState } from 'react';
import type { ApiError } from '../../../request/errors';
import { hasToken, login } from '../../../services/auth';
import { describeFailure } from '../../../session/describe';
import { setPendingEnroll } from '../../../session/pendingEnroll';
import { ENROLL_PATH } from '../../../session/returnUrl';
import { useGoWhenSignedIn, useSession } from '../../../session/useSession';
import { useSubmitOnce } from '../../../session/useSubmitOnce';
import { trimSpec } from '../../../utils/trimSpec';
import { AuthFrame } from '../AuthFrame';

type Values = { username: string; password: string; totp?: string };

export default function Login() {
  const intl = useIntl();
  const [form] = Form.useForm<Values>();
  const { establish } = useSession();
  const goWhenSignedIn = useGoWhenSignedIn();
  const { search } = useLocation();
  const { busy, run } = useSubmitOnce();
  const [needTotp, setNeedTotp] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const totpRef = useRef<{ focus: () => void } | null>(null);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const redirect = new URLSearchParams(search).get('redirect');

  const submit = (values: Values) =>
    run(async () => {
      setNotice(null);
      try {
        const result = await login({
          username: trimSpec(values.username),
          password: values.password,
          totp: needTotp ? trimSpec(values.totp ?? '') : undefined,
        });
        if (!hasToken(result)) {
          setPendingEnroll({
            enrollToken: result.enrollToken,
            otpauthUri: result.otpauthUri,
            redirect,
          });
          history.replace(ENROLL_PATH);
          return;
        }
        const next = await establish(result.token, redirect);
        if (next === undefined) {
          setNotice({ type: 'error', text: t('auth.login.accountFailed') });
          return;
        }
        goWhenSignedIn(next);
      } catch (failure) {
        const { error, text } = describeFailure(intl, failure);
        if (error.code === 'ADMIN_TOTP_REQUIRED') {
          setNeedTotp(true);
          setNotice({ type: 'info', text: t('auth.login.totpHint') });
          setTimeout(() => totpRef.current?.focus(), 0);
        } else if (error.code === 'ADMIN_TOTP_INVALID') {
          form.setFieldValue('totp', '');
          setNotice({ type: 'error', text });
          setTimeout(() => totpRef.current?.focus(), 0);
        } else if (error.code === 'RATE_LIMITED' && retryMinutes(error) !== undefined) {
          setNotice({
            type: 'error',
            text: t('auth.login.locked', { minutes: retryMinutes(error) as number }),
          });
        } else {
          setNotice({ type: 'error', text });
        }
      }
    });

  return (
    <AuthFrame titleId="auth.login.title">
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        <Form.Item
          name="username"
          label={t('auth.login.username')}
          rules={[{ required: true, message: t('auth.login.usernameRequired') }]}
        >
          <Input autoComplete="username" autoFocus />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth.login.password')}
          rules={[{ required: true, message: t('auth.login.passwordRequired') }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        {needTotp ? (
          <Form.Item
            name="totp"
            label={t('auth.login.totp')}
            rules={[{ required: true, message: t('auth.login.totpRequired') }]}
          >
            <Input ref={totpRef as never} inputMode="numeric" autoComplete="one-time-code" />
          </Form.Item>
        ) : null}
        {notice ? (
          <Form.Item>
            <Alert type={notice.type} title={notice.text} showIcon />
          </Form.Item>
        ) : null}
        <Button type="primary" htmlType="submit" block loading={busy} disabled={busy}>
          {t('auth.login.submit')}
        </Button>
      </Form>
    </AuthFrame>
  );
}

/** Whole minutes to wait, when the answer says how many seconds. */
function retryMinutes(error: ApiError): number | undefined {
  const seconds = (error.data as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
  return typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds / 60) : undefined;
}
