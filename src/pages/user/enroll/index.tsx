import { history, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Form, Input, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../../hooks/useRevalidateOnLocaleChange';
import { enrollTotp } from '../../../services/auth';
import { describeFailure, failureNotice, type Notice, noticeText } from '../../../session/describe';
import { groupKey, setupKeyOf } from '../../../session/otpauth';
import { clearPendingEnroll, getPendingEnroll } from '../../../session/pendingEnroll';
import { DEFAULT_RETURN, LOGIN_PATH, safeReturnUrl } from '../../../session/returnUrl';
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [keyShown, setKeyShown] = useState(false);
  // Read once: a successful setup clears the memory copy, and the page must not mistake that for "nothing to set up".
  const [pending] = useState(getPendingEnroll);
  const t = (id: string) => intl.formatMessage({ id });

  // Nothing to set up (the page was opened directly or reloaded): start from sign-in.
  useEffect(() => {
    if (!pending) history.replace(LOGIN_PATH);
  }, [pending]);

  if (!pending) return null;
  const setupKey = setupKeyOf(pending.otpauthUri);

  const backToLogin = (notice?: string) => {
    clearPendingEnroll();
    if (notice) message.warning(notice);
    // Back to sign-in, keeping where the person was going.
    const target = safeReturnUrl(pending.redirect);
    history.replace(
      pending.redirect && target !== DEFAULT_RETURN
        ? `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`
        : LOGIN_PATH,
    );
  };

  const submit = (values: { totp: string }) =>
    run(async () => {
      setNotice(null);
      try {
        const result = await enrollTotp({
          enrollToken: pending.enrollToken,
          totp: trimSpec(values.totp),
        });
        const next = await establish(result.token, pending.redirect);
        if (next === undefined) {
          setNotice({ type: 'error', content: { id: 'auth.login.accountFailed' } });
          return;
        }
        goWhenSignedIn(next);
      } catch (failure) {
        const { error: apiError } = describeFailure(intl, failure);
        if (apiError.code === 'ADMIN_INVALID_TOKEN') {
          backToLogin(t('auth.enroll.expired'));
          return;
        }
        if (apiError.code === 'ADMIN_TOTP_INVALID') form.setFieldValue('totp', '');
        setNotice(failureNotice(failure));
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
        {setupKey ? (
          <Flex vertical align="center" gap={8}>
            <Button type="link" size="small" onClick={() => setKeyShown(!keyShown)}>
              {t(keyShown ? 'auth.enroll.hideKey' : 'auth.enroll.showKey')}
            </Button>
            {keyShown ? (
              <>
                <Typography.Text type="secondary">{t('auth.enroll.keyHelp')}</Typography.Text>
                {/* Letters and digits read left to right whatever the language of the page */}
                <div dir="ltr">
                  <Typography.Text
                    code
                    copyable={{
                      text: setupKey,
                      tooltips: [t('auth.enroll.copy'), t('auth.enroll.copied')],
                    }}
                  >
                    {groupKey(setupKey)}
                  </Typography.Text>
                </div>
              </>
            ) : null}
          </Flex>
        ) : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
          style={{ width: '100%' }}
        >
          <RevalidateOnLocaleChange />
          <Form.Item
            name="totp"
            label={t('auth.enroll.totp')}
            rules={[{ required: true, message: t('auth.enroll.totpRequired') }]}
          >
            <Input inputMode="numeric" autoComplete="one-time-code" autoFocus />
          </Form.Item>
          {notice ? (
            <Form.Item>
              <Alert type={notice.type} title={noticeText(intl, notice)} showIcon />
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
