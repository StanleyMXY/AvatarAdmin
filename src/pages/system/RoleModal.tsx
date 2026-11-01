import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Form, Input, Modal, Spin, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AdminRole,
  createRole,
  listPermissions,
  type PermissionNode,
  updateRole,
} from '../../services/system';
import { describeFailure } from '../../session/describe';
import { useSession } from '../../session/useSession';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';
import { PermissionTreeSelect } from './PermissionTreeSelect';
import { ancestorsOf, buildIndex, codesNotHeld, isSelectable } from './permissionTree';
import { withScopeHint } from './texts';
import { useRead } from './useRead';

type Values = { name: string; remark: string };

/** How many codes the note about codes that are not held names before it gives the number. */
const NOTE_CODES = 20;

type Props = {
  /** The role to change, or null to make a new one. */
  role: AdminRole | null;
  onDone: () => void;
  onClose: () => void;
};

/**
 * The dialog that makes a role or changes one: name, remark and the permissions as a tree of check
 * boxes. Saving replaces the whole set of codes of the role. The tree is read when the dialog opens
 * (the read asks for ROLE:MANAGE or PERMISSION:MANAGE) and Save stays off until it is there: without
 * the tree the codes of the role cannot be sent without wiping or inventing some. Codes of the role
 * that are not nodes of the tree are named and left out of what is saved. A role that has a code the
 * signed-in administrator does not hold (who is not a super administrator) cannot be saved: the
 * backend refuses it, so the dialog says so when it opens and keeps Save off. Mounted only while open.
 */
export function RoleModal({ role, onDone, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; unplaced: string[] } | null>(null);
  const tree = useRead(listPermissions);
  const nodes: PermissionNode[] | null = tree.state.status === 'ok' ? tree.state.data : null;
  const [picked, setPicked] = useState<string[] | null>(null);
  // What the signed-in administrator holds. Only a help for the boxes: `GET /me` is not known to list
  // exactly the codes the backend counts as held, so the backend stays the last word (a 403).
  const { me } = useSession();
  const grantable = useMemo(() => (me && !me.superAdmin ? new Set(me.permissions) : null), [me]);

  // Every code of the role counts, also those that are not nodes of the tree: the backend checks the
  // codes the role has now against what the administrator holds.
  const notHeld = useMemo(
    () => (role === null ? [] : codesNotHeld(role.permissionCodes, grantable)),
    [role, grantable],
  );
  const locked = notHeld.length > 0;

  // What the role holds, limited to the nodes a role may have; the rest is named below.
  const held = useMemo(() => {
    if (nodes === null) return { value: [] as string[], dropped: [] as string[] };
    const index = buildIndex(nodes);
    const wanted = role?.permissionCodes ?? [];
    const keep = (code: string) => {
      const node = index.byCode.get(code);
      return node !== undefined && isSelectable(node);
    };
    return {
      value: [...new Set(wanted.filter(keep))].sort(),
      dropped: [...new Set(wanted.filter((code) => !keep(code)))],
    };
  }, [nodes, role]);
  const value = picked ?? held.value;

  // A function code without the code of the page it is on: a role saved under an older rule can be
  // like that, and its holders cannot open the page. Saving does not add the page (that would give
  // more than the role has), so the dialog says it and the page can be checked.
  const withoutPage = useMemo(() => {
    if (nodes === null) return [] as string[];
    const index = buildIndex(nodes);
    const chosen = new Set(value);
    return value.filter((code) =>
      ancestorsOf(index, code).some((above) => {
        const node = index.byCode.get(above);
        return node !== undefined && isSelectable(node) && !chosen.has(above);
      }),
    );
  }, [nodes, value]);

  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    let values: Values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (nodes === null) return;
    const remark = trimSpec(values.remark ?? '');
    const input = {
      name: trimSpec(values.name),
      remark: remark === '' ? null : remark,
      permissionCodes: value,
    };
    try {
      if (role === null) await createRole(input);
      else await updateRole(role.id, input);
      message.success(t('system.common.saved'));
      onDone();
      onClose();
    } catch (error) {
      const placed = failureToForm(intl, form, error, ['name', 'remark']);
      setFailure(
        placed.text === null
          ? null
          : { text: withScopeHint(intl, error, placed.text), unplaced: placed.unplaced },
      );
    }
  });

  return (
    <Modal
      open
      width={640}
      title={
        role === null
          ? t('system.roles.createTitle')
          : t('system.roles.editTitle', { name: role.name })
      }
      okText={t('system.common.save')}
      cancelText={t('system.common.cancel')}
      okButtonProps={{ disabled: nodes === null || locked || pending, loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      mask={{ closable: false }}
      onOk={() => void run().catch(() => {})}
      onCancel={onClose}
    >
      {locked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={
            notHeld.length > NOTE_CODES
              ? t('system.roles.notHeldMany', {
                  codes: notHeld.slice(0, NOTE_CODES).join(', '),
                  count: notHeld.length,
                })
              : t('system.roles.notHeld', { codes: notHeld.join(', ') })
          }
        />
      ) : null}
      <Form<Values>
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{ name: role?.name ?? '', remark: role?.remark ?? '' }}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="name"
          label={t('system.roles.field.name')}
          rules={[
            {
              validator: async (_, text: string | undefined) => {
                if (trimSpec(text ?? '') === '')
                  throw new Error(t('system.roles.field.nameRequired'));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="remark" label={t('system.roles.field.remark')}>
          <Input.TextArea rows={2} dir="auto" />
        </Form.Item>
      </Form>
      <Typography.Paragraph strong style={{ marginBottom: 4 }}>
        {t('system.roles.field.permissions')}
      </Typography.Paragraph>
      {tree.state.status === 'loading' && nodes === null ? (
        <Flex gap={8} align="center">
          <Spin size="small" />
          <span>{t('system.roles.treeLoading')}</span>
        </Flex>
      ) : null}
      {tree.state.status === 'failed' ? (
        <Alert
          type="error"
          showIcon
          title={t('system.roles.treeFailed', {
            message: describeFailure(intl, tree.state.error).text,
          })}
          action={
            <Button size="small" onClick={tree.reload}>
              {t('system.roles.treeRetry')}
            </Button>
          }
        />
      ) : null}
      {nodes !== null ? (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t('system.roles.selected', { count: value.length })}
          </Typography.Paragraph>
          {withoutPage.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              data-testid="role-without-page"
              title={t('system.roles.withoutPage', {
                codes: withoutPage.slice(0, NOTE_CODES).join(', '),
              })}
            />
          ) : null}
          {held.dropped.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              title={t('system.roles.unknownCodes', { codes: held.dropped.join(', ') })}
            />
          ) : null}
          <PermissionTreeSelect
            nodes={nodes}
            value={value}
            onChange={setPicked}
            grantable={grantable}
          />
        </>
      ) : null}
      {failure ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12 }}
          title={failure.text}
          description={
            failure.unplaced.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                {failure.unplaced.map((text, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the same text can be there twice
                  <li key={i}>{text}</li>
                ))}
              </ul>
            ) : undefined
          }
        />
      ) : null}
    </Modal>
  );
}
