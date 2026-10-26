import { history, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Form, Input, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { enrollTotp } from '../../../services/auth';
import { describeFailure } from '../../../session/describe';
import { clearPendingEnroll, getPendingEnroll } from '../../../session/pendingEnroll';
import { LOGIN_PATH } from '../../../session/returnUrl';
import { useGoWhenSignedIn, useSession } from '../../../session/useSession';
import { useSubmitOnce } from '../../../session/useSubmitOnce';
import { trimSpec } from '../../../utils/trimSpec';
import { AuthFrame } from '../AuthFrame';

export default function Enroll() {
  const intl = useIntl();
  const { message } = App.useApp();
  const { establish } = useSession();
  const goWhenSignedIn = useGoWhenSignedIn();
  const { busy, run } = useSubmitOnce();
  const [form] = Form.useForm<{ totp: string }>();
  const [error, setError] = useState<string | null>(null);
  // Read once: a successful setup clears the memory copy, and the page must not mistake that for "nothing to set up".
  const [pending] = useState(getPendingEnroll);
  const t = (id: string) => intl.formatMessage({ id });

  // Nothing to set up (the page was opened directly or reloaded): start from sign-in.
  useEffect(() => {
    if (!pending) history.replace(LOGIN_PATH);
  }, [pending]);

  if (!pending) return null;

  const backToLogin = (notice?: string) => {
    clearPendingEnroll();
    if (notice) message.warning(notice);
    history.replace(LOGIN_PATH);
  };

  const submit = (values: { totp: string }) =>
    run(async () => {
      setError(null);
      try {
        const result = await enrollTotp({
          enrollToken: pending.enrollToken,
          totp: trimSpec(values.totp),
        });
        const next = await establish(result.token, pending.redirect);
        if (next === undefined) {
          setError(t('auth.login.accountFailed'));
          return;
        }
        goWhenSignedIn(next);
      } catch (failure) {
        const { error: apiError, text } = describeFailure(intl, failure);
        if (apiError.code === 'ADMIN_INVALID_TOKEN') {
          backToLogin(t('auth.enroll.expired'));
          return;
        }
        if (apiError.code === 'ADMIN_TOTP_INVALID') form.setFieldValue('totp', '');
        setError(text);
      }
    });

  return (
    <AuthFrame titleId="auth.enroll.title">
      <Flex vertical align="center" gap={16}>
        <Typography.Paragraph>{t('auth.enroll.intro')}</Typography.Paragraph>
        <div
          role="img"
          aria-label={t('auth.enroll.qrLabel')}
          style={{ background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}
        >
          {/* Drawn here from the address the server sent; nothing is sent to a QR service. */}
          <QRCodeSVG value={pending.otpauthUri} size={192} marginSize={0} />
        </div>
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
          style={{ width: '100%' }}
        >
          <Form.Item
            name="totp"
            label={t('auth.enroll.totp')}
            rules={[{ required: true, message: t('auth.enroll.totpRequired') }]}
          >
            <Input inputMode="numeric" autoComplete="one-time-code" autoFocus />
          </Form.Item>
          {error ? (
            <Form.Item>
              <Alert type="error" title={error} showIcon />
            </Form.Item>
          ) : null}
          <Button type="primary" htmlType="submit" block loading={busy} disabled={busy}>
            {t('auth.enroll.submit')}
          </Button>
          <Button type="link" block onClick={() => backToLogin()}>
            {t('auth.enroll.back')}
          </Button>
        </Form>
      </Flex>
    </AuthFrame>
  );
}
