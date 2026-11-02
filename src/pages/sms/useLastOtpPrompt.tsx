import { useIntl } from '@umijs/max';
import { App, Typography } from 'antd';
import { useCallback } from 'react';
import { ApiError } from '../../request/errors';
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

/** The detail the backend gives when a channel write would leave no enabled OTP channel, or a country without one: its `ref` is the entity, not a field of a form. */
const CHANNEL_ENTITY = 'SmsChannel';
const OUT_OF_RANGE = 'OUT_OF_RANGE';

/**
 * True when the backend refused a channel write because it would remove the last enabled OTP
 * channel, or leave a country without one, while phone sign-in is on or phone-number accounts exist
 * (contract 23.4). The two cases have the same `ref` and `reason` (answers 41); the page does not
 * judge this beforehand beyond the question it asks: the answer is the only source.
 */
export function isLastChannelRefusal(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'INVALID_REQUEST' &&
    error.details.some((d) => d.ref === CHANNEL_ENTITY && d.reason === OUT_OF_RANGE)
  );
}

/**
 * The words of a failed channel write. The refusal above has one fixed text that covers both of its
 * cases; anything else is the words of the code. The backend's own message is never shown.
 */
export function guardedFailureText(intl: Translator, error: unknown): string {
  return isLastChannelRefusal(error)
    ? intl.formatMessage({ id: 'sms.channels.lastRefused' })
    : describeFailure(intl, error).text;
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
