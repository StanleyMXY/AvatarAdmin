import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Form, Input, Modal, Select, Switch, Typography } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import type { Me } from '../../services/auth';
import {
  type AdminPatch,
  type AdminUser,
  createAdmin,
  loadAllRoles,
  updateAdmin,
} from '../../services/system';
import { describeFailure } from '../../session/describe';
import { trimSpec } from '../../utils/trimSpec';
import { checkNewPassword, type RowProtection } from './adminRules';
import { failureToForm } from './formFailure';
import { useRead } from './useRead';

type Values = {
  username: string;
  password: string;
  confirm: string;
  roleIds: string[];
  superAdmin: boolean;
};

const FIELDS = ['username', 'password', 'roleIds', 'superAdmin'];
const ROLE_LIST_CODE = 'ROLE:MANAGE';

type Props = {
  /** The administrator to edit, or null to make a new one. */
  admin: AdminUser | null;
  me: Me | undefined;
  /** What the rules of the account protect on this row (nothing for a new administrator). */
  protection: RowProtection;
  onDone: () => void;
  onClose: () => void;
};

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * The dialog that makes an administrator or changes the roles and the super administrator flag of
 * one. It is mounted only while it is open, so a second use never starts from the values of the first.
 * - The user name is typed once, at creation; afterwards it is shown and cannot be changed.
 * - The initial password goes to the server as typed. It is not kept: the form is emptied of it as
 *   soon as the request has gone, and nothing of the answer is read for a password.
 * - On the own row the roles and the flag are disabled and nothing of them is sent (the service
 *   leaves them out too). The flag is for a super administrator only, and cannot be cleared on the last
 *   enabled super administrator. The roles come from `GET /roles`; when they cannot be read the choice
 *   is disabled and the roles are not sent.
 */
export function AdminFormModal({ admin, me, protection, onDone, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const roles = useRead(loadAllRoles);
  const creating = admin === null;
  const minLength = me?.passwordMinLength;
  const canSetSuper = me?.superAdmin === true;

  const original = admin?.roles.map((r) => r.id) ?? [];
  const chosenRoles = Form.useWatch('roleIds', form) ?? original;
  const chosenSuper = Form.useWatch('superAdmin', form) ?? admin?.superAdmin ?? false;

  const rolesReadable = roles.state.status === 'ok';
  const rolesLocked = protection.own || !rolesReadable;
  const flagLocked = protection.own || !canSetSuper || protection.lastSuper;
  const rolesChanged = !rolesLocked && !sameSet(chosenRoles, original);
  const flagChanged = !flagLocked && chosenSuper !== (admin?.superAdmin ?? false);
  const nothingToSave = !creating && !rolesChanged && !flagChanged;

  const forbidden =
    roles.state.status === 'failed' &&
    roles.state.error instanceof ApiError &&
    (roles.state.error.httpStatus === 403 || roles.state.error.code === 'ADMIN_FORBIDDEN');

  const options = [
    ...(roles.state.data ?? []).map((role) => ({ value: role.id, label: role.name })),
    ...(admin?.roles ?? [])
      .filter((r) => !(roles.state.data ?? []).some((role) => role.id === r.id))
      .map((role) => ({ value: role.id, label: role.name })),
  ];

  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    let values: Values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (creating) {
        await createAdmin({
          username: trimSpec(values.username),
          password: values.password,
          roleIds: rolesReadable ? (values.roleIds ?? []) : [],
          superAdmin: canSetSuper && values.superAdmin === true,
        });
        message.success(t('system.admins.createDone'));
      } else {
        const patch: AdminPatch = {};
        if (rolesChanged) patch.roleIds = values.roleIds ?? [];
        if (flagChanged) patch.superAdmin = values.superAdmin === true;
        await updateAdmin(admin, patch, me);
        message.success(t('system.common.saved'));
      }
      // The password has gone; nothing of it stays in the form.
      form.setFieldsValue({ password: '', confirm: '' });
      onDone();
      onClose();
    } catch (error) {
      const placed = failureToForm(intl, form, error, FIELDS);
      setFailure(placed.text);
    }
  });

  const problemText = (problem: { key: string; values?: Record<string, number> }) =>
    t(problem.key, problem.values);

  return (
    <Modal
      open
      width={560}
      title={
        creating
          ? t('system.admins.createTitle')
          : t('system.admins.editTitle', { name: admin.username })
      }
      okText={t('system.common.save')}
      cancelText={t('system.common.cancel')}
      okButtonProps={{ disabled: nothingToSave || pending, loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      maskClosable={false}
      onOk={() => void run().catch(() => {})}
      onCancel={onClose}
    >
      <Form<Values>
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          username: admin?.username ?? '',
          password: '',
          confirm: '',
          roleIds: original,
          superAdmin: admin?.superAdmin ?? false,
        }}
      >
        {protection.own && !creating ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('system.admins.ownNote')}
          />
        ) : null}
        <Form.Item
          name="username"
          label={t('system.admins.field.username')}
          extra={creating ? undefined : t('system.admins.field.usernameReadOnly')}
          rules={
            creating
              ? [
                  {
                    validator: async (_, value: string | undefined) => {
                      if (trimSpec(value ?? '') === '')
                        throw new Error(t('system.admins.field.usernameRequired'));
                    },
                  },
                ]
              : []
          }
        >
          <Input disabled={!creating} dir="auto" autoComplete="off" />
        </Form.Item>
        {creating ? (
          <>
            <Form.Item
              name="password"
              label={t('system.admins.field.password')}
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
                      username: trimSpec(form.getFieldValue('username') ?? ''),
                      minLength,
                    });
                    if (result) throw new Error(problemText(result.problem));
                  },
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label={t('system.admins.field.passwordConfirm')}
              dependencies={['password']}
              rules={[
                {
                  validator: async (_, value: string | undefined) => {
                    const password = form.getFieldValue('password') ?? '';
                    if ((value ?? '') === '') throw new Error(t('auth.password.confirmRequired'));
                    if (value !== password) throw new Error(t('auth.password.mismatch'));
                  },
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </>
        ) : null}
        <Form.Item
          name="roleIds"
          label={t('system.admins.field.roles')}
          extra={
            roles.state.status === 'loading' && roles.state.data === null ? (
              t('system.admins.field.rolesLoading')
            ) : forbidden ? (
              t('system.admins.field.rolesForbidden', {
                permission: t(`permission.${ROLE_LIST_CODE}`),
                code: ROLE_LIST_CODE,
              })
            ) : roles.state.status === 'failed' ? (
              <Flex gap={8} align="center" wrap>
                <span>
                  {t('system.admins.field.rolesFailed', {
                    message: describeFailure(intl, roles.state.error).text,
                  })}
                </span>
                <Button size="small" onClick={roles.reload}>
                  {t('system.admins.field.rolesRetry')}
                </Button>
              </Flex>
            ) : undefined
          }
        >
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            options={options}
            disabled={rolesLocked}
            loading={roles.state.status === 'loading'}
            placeholder={t('system.admins.field.rolesPlaceholder')}
          />
        </Form.Item>
        {!creating && !rolesReadable && admin.roles.length > 0 ? (
          <Typography.Paragraph type="secondary" style={{ overflowWrap: 'anywhere' }}>
            {t('system.admins.field.rolesCurrent', {
              names: admin.roles.map((r) => r.name).join(', '),
            })}
          </Typography.Paragraph>
        ) : null}
        <Form.Item
          name="superAdmin"
          label={t('system.admins.field.superAdmin')}
          valuePropName="checked"
          extra={
            !canSetSuper
              ? t('system.admins.superNeedsSuper')
              : protection.lastSuper
                ? t('system.admins.superLast')
                : t('system.admins.field.superAdminHint')
          }
        >
          <Switch disabled={flagLocked} />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
