import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useRef, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  createPermission,
  type PermissionNode,
  type PermissionType,
  updatePermission,
} from '../../services/system';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';
import { buildPermissionPatch, codeProblem, nextSortOrder } from './permissionRules';
import { buildIndex, isBuiltinNode, nodeName, parentCandidates } from './permissionTree';

type Values = {
  code: string;
  type: PermissionType;
  parent: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number | null;
};

const FIELDS = ['code', 'type', 'parent', 'nameZh', 'nameEn', 'sortOrder'];
const NO_PARENT = '';

type Props = {
  /** The node to change, or null to make a new one. */
  node: PermissionNode | null;
  /** Every node of the tree: the choice of parents and the checks are made on it. */
  nodes: PermissionNode[];
  onDone: () => void;
  onClose: () => void;
};

/**
 * The dialog that makes a node of the permission tree or changes one.
 * - A new node asks for parent, type, code, both names and the order; the code cannot be changed
 *   afterwards, and neither can the type. The order starts as the end of the siblings under the
 *   parent chosen (one more than the last of them) and follows the parent until the person types one.
 * - A built-in node changes only its names and its order: code, type and parent are shown and fixed.
 * - A custom node may also get another parent. The parents on offer are every node except the node
 *   itself and the nodes below it, so no loop can be made; the request is checked once more on the way
 *   out (buildPermissionPatch).
 * Mounted only while it is open.
 */
export function PermissionNodeModal({ node, nodes, onDone, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  // The order stops following the parent once the person has typed one.
  const orderTyped = useRef(false);
  const creating = node === null;
  const builtin = node !== null && isBuiltinNode(node);

  const index = buildIndex(nodes);
  const allowed = creating ? index.codes : parentCandidates(nodes, node.code);
  // A built-in node shows its own parent; nothing else is on offer to it.
  const shown =
    builtin && node.parent !== null && !allowed.includes(node.parent)
      ? [...allowed, node.parent]
      : allowed;
  const parentOptions = [
    { value: NO_PARENT, label: t('system.permissions.field.parentNone') },
    ...shown.flatMap((code) => {
      const found = index.byCode.get(code);
      return found ? [{ value: code, label: `${nodeName(found, intl.locale)} (${code})` }] : [];
    }),
  ];

  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    let values: Values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const parent = values.parent === NO_PARENT ? null : values.parent;
    try {
      if (creating) {
        await createPermission({
          code: trimSpec(values.code),
          parent,
          type: values.type,
          sortOrder: values.sortOrder as number,
          nameZh: trimSpec(values.nameZh),
          nameEn: trimSpec(values.nameEn),
        });
      } else {
        const built = buildPermissionPatch(nodes, node, {
          nameZh: values.nameZh,
          nameEn: values.nameEn,
          sortOrder: values.sortOrder as number,
          parent,
        });
        if (!built.ok) {
          form.setFields([{ name: 'parent', errors: [t('system.permissions.field.parentLoop')] }]);
          return;
        }
        await updatePermission(node.code, built.patch, { builtin });
      }
      message.success(t('system.common.saved'));
      onDone();
      onClose();
    } catch (error) {
      setFailure(failureToForm(intl, form, error, FIELDS).text);
    }
  });

  const nameRule = {
    validator: async (_: unknown, value: string | undefined) => {
      if (trimSpec(value ?? '') === '') throw new Error(t('system.permissions.field.nameRequired'));
    },
  };

  return (
    <Modal
      open
      width={560}
      title={
        creating
          ? t('system.permissions.createTitle')
          : t('system.permissions.editTitle', { code: node.code })
      }
      okText={t('system.common.save')}
      cancelText={t('system.common.cancel')}
      okButtonProps={{ disabled: pending, loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      mask={{ closable: false }}
      onOk={() => void run().catch(() => {})}
      onCancel={onClose}
    >
      {builtin ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('system.permissions.builtinNote')}
        />
      ) : null}
      <Form<Values>
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          code: node?.code ?? '',
          type: node?.type ?? 'MENU',
          parent: node?.parent ?? NO_PARENT,
          nameZh: typeof node?.nameZh === 'string' ? node.nameZh : '',
          nameEn: typeof node?.nameEn === 'string' ? node.nameEn : '',
          sortOrder: creating
            ? nextSortOrder(nodes, null)
            : typeof node.sortOrder === 'number'
              ? node.sortOrder
              : 0,
        }}
        onValuesChange={(changed: Partial<Values>) => {
          if (!creating) return;
          if ('sortOrder' in changed) orderTyped.current = true;
          else if ('parent' in changed && !orderTyped.current) {
            const parent = changed.parent === NO_PARENT ? null : (changed.parent ?? null);
            form.setFieldValue('sortOrder', nextSortOrder(nodes, parent));
          }
        }}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="parent"
          label={t('system.permissions.field.parent')}
          extra={creating || !builtin ? t('system.permissions.field.parentHint') : undefined}
        >
          <Select
            showSearch
            optionFilterProp="label"
            virtual={false}
            options={parentOptions}
            disabled={builtin}
          />
        </Form.Item>
        <Form.Item name="type" label={t('system.permissions.field.type')}>
          <Select
            disabled={!creating}
            options={(['MENU', 'FUNCTION'] as const).map((type) => ({
              value: type,
              label: t(`system.permissions.type.${type}`),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="code"
          label={t('system.permissions.field.code')}
          extra={creating ? undefined : t('system.permissions.field.codeHint')}
          rules={
            creating
              ? [
                  {
                    validator: async (_, value: string | undefined) => {
                      const problem = codeProblem(value ?? '', nodes);
                      if (problem) throw new Error(t(`system.permissions.field.code.${problem}`));
                    },
                  },
                ]
              : []
          }
        >
          <Input disabled={!creating} dir="auto" />
        </Form.Item>
        <Form.Item name="nameZh" label={t('system.permissions.field.nameZh')} rules={[nameRule]}>
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="nameEn" label={t('system.permissions.field.nameEn')} rules={[nameRule]}>
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="sortOrder"
          label={t('system.permissions.field.sortOrder')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (typeof value !== 'number' || !Number.isSafeInteger(value))
                  throw new Error(t('system.permissions.field.sortOrderRequired'));
              },
            },
          ]}
        >
          <InputNumber precision={0} style={{ width: '100%' }} />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
