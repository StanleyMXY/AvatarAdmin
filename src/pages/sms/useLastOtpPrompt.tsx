import { useIntl } from '@umijs/max';
import { App, Typography } from 'antd';
import { useCallback } from 'react';
import { listConfig } from '../../services/config';
import { describeFailure } from '../../session/describe';
import type { Translator } from '../../utils/displayText';

export type GuardAction = 'disable' | 'delete' | 'change';
export type GuardSubject = 'channel' | 'template' | 'englishTemplate';

const PHONE_SIGN_IN_KEY = 'auth.phone_login_enabled';

/**
 * Whether phone sign-in is on, as far as the administrator can tell: true or false, or null when the
 * setting cannot be read (`GET /config` answers only the keys that the administrator may edit, and
 * a failed read is not a reason to stop the question).
 */
export async function readPhoneSignIn(): Promise<boolean | null> {
  try {
    const { items } = await listConfig();
    const item = Array.isArray(items)
      ? items.find((entry) => (entry as { key?: unknown } | null)?.key === PHONE_SIGN_IN_KEY)
      : undefined;
    const value = (item as { value?: unknown } | undefined)?.value;
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

/**
 * The words of a failed write. When the write was one that the question was asked for and the
 * backend answers INVALID_REQUEST, a line follows the words of the code that says what the refusal
 * means: the backend refuses while phone sign-in is on or phone-number accounts exist (contract
 * 23.4). The backend's own message is never shown.
 */
export function guardedFailureText(intl: Translator, error: unknown, guarded: boolean): string {
  const { error: failure, text } = describeFailure(intl, error);
  return guarded && failure.code === 'INVALID_REQUEST'
    ? `${text} ${intl.formatMessage({ id: 'sms.guard.refused' })}`
    : text;
}

/**
 * The question asked before the last enabled OTP channel or template is switched off, deleted or
 * changed so that it stops serving codes. It names the two conditions under which the backend
 * refuses (phone sign-in is on; phone-number accounts exist), says what is known of the first by
 * reading the setting now, and resolves true when the administrator goes on. The backend has the last word.
 */
export function useLastOtpPrompt() {
  const intl = useIntl();
  const { modal } = App.useApp();
  return useCallback(
    async (action: GuardAction, subject: GuardSubject): Promise<boolean> => {
      const phoneSignIn = await readPhoneSignIn();
      const t = (id: string, values?: Record<string, string | number>) =>
        intl.formatMessage({ id }, values);
      const signInLine =
        phoneSignIn === true
          ? t('sms.guard.signInOn')
          : phoneSignIn === false
            ? t('sms.guard.signInOff')
            : t('sms.guard.signInUnknown');
      return new Promise<boolean>((resolve) => {
        modal.confirm({
          title: t(`sms.guard.title.${subject}`),
          content: (
            <>
              <Typography.Paragraph>
                {t(`sms.guard.intro.${subject}`, { action: t(`sms.guard.action.${action}`) })}
              </Typography.Paragraph>
              <ul style={{ paddingInlineStart: 20 }}>
                <li>{signInLine}</li>
                <li>{t('sms.guard.accounts')}</li>
              </ul>
              <Typography.Paragraph type="secondary">{t('sms.guard.final')}</Typography.Paragraph>
            </>
          ),
          okText: t('sms.guard.ok'),
          cancelText: t('pages.common.cancel'),
          okButtonProps: { danger: true },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
    },
    [intl, modal],
  );
}
