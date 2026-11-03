import { useIntl } from '@umijs/max';
import { App, Typography } from 'antd';
import { useCallback } from 'react';
import { ApiError } from '../../request/errors';
import { getSmsMeta } from '../../services/sms';
import { describeFailure } from '../../session/describe';
import type { Translator } from '../../utils/displayText';

export type GuardAction = 'disable' | 'delete' | 'change';
export type GuardSubject = 'channel' | 'template' | 'englishTemplate';

/** What the guard of the last OTP channel and template depends on, as `GET /sms/meta` says; null for what could not be read. */
export type PhoneGuard = { phoneLoginEnabled: boolean | null; phoneAccountCount: number | null };

/**
 * Whether phone sign-in is on and how many accounts have a phone number, read now from the SMS meta
 * (any `SMS:*` code may read it, so the administrator who can change a channel can also see this).
 * Null when the meta cannot be read: that is not a reason to stop the question.
 */
export async function readPhoneGuard(): Promise<PhoneGuard | null> {
  try {
    const { phoneLoginEnabled, phoneAccountCount } = await getSmsMeta();
    return { phoneLoginEnabled, phoneAccountCount };
  } catch {
    return null;
  }
}

/** True only when the meta says that neither condition holds: then the backend does not guard anything and the guard question is not asked. */
const guardOff = (guard: PhoneGuard | null): boolean =>
  guard !== null && guard.phoneLoginEnabled === false && guard.phoneAccountCount === 0;

/** The detail the backend gives when a channel write would leave no enabled OTP channel, or a country without one: its `ref` is the entity, not a field of a form. */
const CHANNEL_ENTITY = 'SmsChannel';
const CHANNEL_REASONS = ['LAST_OTP_CHANNEL', 'COUNTRY_LOSES_OTP_CHANNEL'] as const;

/**
 * The reason of the refusal of a channel write that would remove the last enabled OTP channel
 * (`LAST_OTP_CHANNEL`), or leave a country without one (`COUNTRY_LOSES_OTP_CHANNEL`), while phone
 * sign-in is on or phone-number accounts exist (contract 23.4); undefined for any other failure.
 */
export function lastChannelReason(error: unknown): (typeof CHANNEL_REASONS)[number] | undefined {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_REQUEST') return undefined;
  return CHANNEL_REASONS.find((reason) =>
    error.details.some((d) => d.ref === CHANNEL_ENTITY && d.reason === reason),
  );
}

export const isLastChannelRefusal = (error: unknown): boolean =>
  lastChannelReason(error) !== undefined;

/**
 * The words of a failed channel write. Each of the two refusals above has its own fixed text (the
 * text of its reason); anything else is the words of the code. The backend's own message is never shown.
 */
export function guardedFailureText(intl: Translator, error: unknown): string {
  const reason = lastChannelReason(error);
  return reason === undefined
    ? describeFailure(intl, error).text
    : intl.formatMessage({ id: `reason.${reason}` });
}

/**
 * The question asked before the last enabled OTP channel or template is switched off, deleted or
 * changed so that it stops serving codes. It reads the SMS meta now: when phone sign-in is off and
 * no account has a phone number the backend does not refuse, so a switch-off or change asks nothing and
 * a delete asks only whether to delete; otherwise it names
 * the condition(s) that hold, with the number of accounts, and resolves true when the administrator
 * goes on. When the meta cannot be read the question names both conditions as unknown. The backend
 * has the last word.
 */
export function useLastOtpPrompt() {
  const intl = useIntl();
  const { modal } = App.useApp();
  return useCallback(
    async (action: GuardAction, subject: GuardSubject): Promise<boolean> => {
      const guard = await readPhoneGuard();
      const t = (id: string, values?: Record<string, string | number>) =>
        intl.formatMessage({ id }, values);
      if (guardOff(guard)) {
        // The backend does not guard anything now: switching off or changing needs no question, but a
        // delete cannot be undone (and the credentials of a channel are gone with it), so it is asked
        // as plainly as the delete of any other row.
        if (action !== 'delete') return true;
        return new Promise<boolean>((resolve) => {
          modal.confirm({
            title: t(subject === 'channel' ? 'sms.channels.deleteAsk' : 'sms.templates.deleteAsk'),
            okText: t('sms.common.delete'),
            cancelText: t('pages.common.cancel'),
            okButtonProps: { danger: true },
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
      }
      const signInLine =
        guard?.phoneLoginEnabled === true
          ? t('sms.guard.signInOn')
          : guard?.phoneLoginEnabled === false
            ? t('sms.guard.signInOff')
            : t('sms.guard.signInUnknown');
      const count = guard?.phoneAccountCount;
      const accountsLine =
        typeof count === 'number'
          ? count > 0
            ? t('sms.guard.accountsSome', { count })
            : t('sms.guard.accountsNone')
          : t('sms.guard.accountsUnknown');
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
                <li>{accountsLine}</li>
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
