import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Form, Input } from 'antd';
import { useState } from 'react';
import { changePassword } from '../../services/auth';
import { describeFailure } from '../../session/describe';
import { checkPasswordChange } from '../../session/passwordRules';
import { useSubmitOnce } from '../../session/useSubmitOnce';

type Values = { oldPassword: string; newPassword: string; confirm: string };
type Field = keyof Values;

type Props = {
  username?: string;
  /** The shortest password in characters, when the server told us; unknown means the server decides. */
  minLength?: number;
  /** Called after the password was changed (the old token no longer works). */
  onDone: () => void;
  onCancel?: () => void;
};

/** Old password, new password, new password again. Used by the forced page and by the header menu's dialog. */
export function ChangePasswordForm({ username, minLength, onDone, onCancel }: Props) {
  const intl = useIntl();
  const [form] = Form.useForm<Values>();
  const { busy, run } = useSubmitOnce();
  // The failure itself is kept, so that the bar is written again when the language changes.
  const [alert, setAlert] = useState<{ failure: unknown } | null>(null);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  // One rule per field: it reports the first problem of the whole form if that problem belongs to the field.
  const rule = (field: Field) => ({
    validator: async () => {
      const typed = form.getFieldsValue();
      const problem = checkPasswordChange({
        oldPassword: typed.oldPassword ?? '',
        newPassword: typed.newPassword ?? '',
        confirm: typed.confirm ?? '',
        username,
        minLength,
      });
      if (problem?.field === field) {
        const { key } = problem.problem;
        const values = 'values' in problem.problem ? problem.problem.values : undefined;
        throw new Error(t(key, values));
      }
    },
  });

  const alertText = (failure: unknown) => {
    const { error, text } = describeFailure(intl, failure);
    return error.code === 'INVALID_REQUEST' && error.message ? `${text}: ${error.message}` : text;
  };

  const submit = (values: Values) =>
    run(async () => {
      setAlert(null);
      try {
        await changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
        onDone();
      } catch (failure) {
        const { error, fields } = describeFailure(intl, failure);
        if (error.code === 'ADMIN_INVALID_CREDENTIALS') {
          form.setFields([{ name: 'oldPassword', errors: [t('auth.password.oldWrong')] }]);
          return;
        }
        const named = fields.filter((f) => f.ref === 'oldPassword' || f.ref === 'newPassword');
        if (named.length > 0) {
          form.setFields(named.map((f) => ({ name: f.ref as Field, errors: [f.text] })));
          return;
        }
        // The backend's own sentence is the only place the reason is spelled out for a rule the
        // browser did not know (for example a minimum length it was not told).
        setAlert({ failure });
      }
    });

  return (
    <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
      <Form.Item name="oldPassword" label={t('auth.password.old')} rules={[rule('oldPassword')]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item
        name="newPassword"
        label={t('auth.password.new')}
        extra={
          minLength === undefined ? undefined : t('auth.password.lengthHint', { min: minLength })
        }
        rules={[rule('newPassword')]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="confirm"
        label={t('auth.password.confirm')}
        dependencies={['newPassword']}
        rules={[rule('confirm')]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      {alert ? (
        <Form.Item>
          <Alert type="error" title={alertText(alert.failure)} showIcon />
        </Form.Item>
      ) : null}
      <Flex gap={8} justify="flex-end">
        {onCancel ? (
          <Button onClick={onCancel} disabled={busy}>
            {t('auth.password.cancel')}
          </Button>
        ) : null}
        <Button type="primary" htmlType="submit" loading={busy} disabled={busy}>
          {t('auth.password.submit')}
        </Button>
      </Flex>
    </Form>
  );
}
