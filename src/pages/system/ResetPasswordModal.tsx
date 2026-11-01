import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useFailureView } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { Me } from '../../services/auth';
import { type AdminUser, resetAdminPassword } from '../../services/system';
import { plainText } from '../../utils/plainText';
import { checkNewPassword } from './adminRules';
import { failureToForm, failureView } from './formFailure';
import { withScopeHint } from './texts';

type Values = { newPassword: string; confirm: string };

type Props = {
  admin: AdminUser;
  me: Me | undefined;
  onDone: () => void;
  onClose: () => void;
};

/**
 * Sets a new password for another administrator. The dialog says what happens (the administrator must
 * change it at the next sign-in, their sessions end now, and the password is not shown again), and
 * only the button of the dialog sends it. The password goes as typed; it is not kept after the request
 * has gone, not shown in any answer, and not written to the address or the browser's storage. The
 * dialog is mounted only while it is open.
 */
export function ResetPasswordModal({ admin, me, onDone, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { view: failure, show, clear } = useFailureView<string | null>();
  const minLength = me?.passwordMinLength;
  const adminName = plainText(admin.username);

  const { run, pending } = useSingleFlight(async () => {
    clear();
    let values: Values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await resetAdminPassword(plainText(admin.id), values.newPassword);
      message.success(t('system.admins.resetDone', { name: adminName }));
      onDone();
      onClose();
    } catch (error) {
      failureToForm(intl, form, error, ['newPassword']);
      show((words) => {
        const { text } = failureView(words, error, ['newPassword']);
        return text === null ? null : withScopeHint(words, error, text);
      });
    }
  });

  return (
    <Modal
      open
      width={520}
      title={t('system.admins.resetTitle', { name: adminName })}
      okText={t('system.admins.resetOk')}
      okButtonProps={{ danger: true, loading: pending, disabled: pending }}
      cancelText={t('system.common.cancel')}
      cancelButtonProps={{ disabled: pending }}
      mask={{ closable: false }}
      onOk={() => void run().catch(() => {})}
      onCancel={onClose}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={t('system.admins.resetNote', { name: adminName })}
      />
      <Form<Values>
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{ newPassword: '', confirm: '' }}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="newPassword"
          label={t('system.admins.resetField')}
          extra={
            minLength !== undefined
              ? t('system.admins.field.passwordHint', { min: minLength })
              : t('system.admins.field.passwordHintNoMin')
          }
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const result = checkNewPassword({
                  password: value ?? '',
                  confirm: value ?? '',
                  username: adminName,
                  minLength,
                });
                if (result)
                  throw new Error(
                    t(
                      result.problem.key,
                      'values' in result.problem ? result.problem.values : undefined,
                    ),
                  );
              },
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('system.admins.field.passwordConfirm')}
          dependencies={['newPassword']}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if ((value ?? '') === '') throw new Error(t('auth.password.confirmRequired'));
                if (value !== form.getFieldValue('newPassword'))
                  throw new Error(t('auth.password.mismatch'));
              },
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
