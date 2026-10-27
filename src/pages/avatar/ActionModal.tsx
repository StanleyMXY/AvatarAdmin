import { useIntl } from '@umijs/max';
import { Alert, App, Checkbox, Flex, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useState } from 'react';
import { UploadField } from '../../components/UploadField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type ActionItem,
  AVATAR_STYLES,
  type AvatarStyle,
  createAction,
  type Surface,
  TRIGGERABLE_BY,
  type TriggerableBy,
  updateAction,
} from '../../services/avatar';
import { trimSpec } from '../../utils/trimSpec';
import { SPEC_MAX, specRule } from './CosmeticModal';
import { failureToForm } from './formFailure';
import { LocalizedTextsField } from './LocalizedTextsField';
import { cleanTexts, type Texts } from './localized';
import { SurfacesPicker } from './SurfacesPicker';
import { Thumb } from './Thumb';
import { codeText } from './texts';
import { UploadBox } from './UploadBox';
import { useUploadSlot } from './uploadSlot';

type Values = {
  key: string;
  names: Texts;
  description: string;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  triggerableBy: TriggerableBy;
  sortOrder: number | null;
  enabled: boolean;
};

type Props = {
  open: boolean;
  /** The action being edited; none means a new action. */
  action: ActionItem | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'key',
  'names',
  'description',
  'generationSpec',
  'compatibleStyles',
  'surfaces',
  'triggerableBy',
  'sortOrder',
  'enabled',
] as const;

/**
 * New or edit action. Every action is a clip generated in advance from the generation text; there
 * is no kind and no curve upload. The key is fixed once the action exists; the icon goes up first
 * and only its id is sent.
 */
export function ActionModal({ open, action, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [iconProblem, setIconProblem] = useState<string | null>(null);
  const icon = useUploadSlot();
  const editing = action !== null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setIconProblem(null);
    if (!editing && !icon.uploadId) {
      setIconProblem(t('avatar.icon.required'));
      return;
    }
    const fields = {
      names: cleanTexts(values.names),
      description: trimSpec(values.description),
      generationSpec: trimSpec(values.generationSpec),
      compatibleStyles: values.compatibleStyles ?? [],
      surfaces: values.surfaces ?? [],
      triggerableBy: values.triggerableBy,
      sortOrder: values.sortOrder ?? 0,
      ...(icon.uploadId ? { iconUploadId: icon.uploadId } : {}),
    };
    try {
      if (action) {
        await updateAction(action.id, fields);
      } else {
        await createAction({ ...fields, key: trimSpec(values.key), enabled: values.enabled });
      }
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      if (result.uploadRejected) {
        icon.reset();
        setIconProblem(t('avatar.icon.rejected'));
      }
      setFailure(result.text);
      return;
    }
    message.success(t('avatar.actions.saved'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t(editing ? 'avatar.actions.edit' : 'avatar.actions.new')}
      destroyOnHidden
      width={640}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        icon.reset();
        setFailure(null);
        setIconProblem(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || icon.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="action"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          key: action?.key ?? '',
          names: action?.names ?? {},
          description: action?.description ?? '',
          generationSpec: action?.generationSpec ?? '',
          compatibleStyles: action?.compatibleStyles ?? ['STYLIZED_3D'],
          surfaces: action?.surfaces ?? [],
          triggerableBy: action?.triggerableBy ?? 'BOTH',
          sortOrder: action?.sortOrder ?? 0,
          enabled: action?.enabled ?? false,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="key"
          label={t('avatar.col.key')}
          extra={editing ? t('avatar.key.fixed') : undefined}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') throw new Error(t('avatar.key.required'));
              },
            },
          ]}
        >
          <Input disabled={editing} />
        </Form.Item>
        <Form.Item
          name="names"
          label={t('avatar.col.names')}
          rules={[
            {
              validator: async (_, value: Texts | undefined) => {
                if (Object.keys(cleanTexts(value)).length === 0) {
                  throw new Error(t('avatar.names.required'));
                }
              },
            },
          ]}
        >
          <LocalizedTextsField />
        </Form.Item>
        <Form.Item label={t('avatar.col.icon')}>
          <Flex vertical gap={8}>
            {action ? <Thumb url={action.iconUrl} alt={action.key} size={64} /> : null}
            <UploadBox>
              <UploadField<{ uploadId: string }>
                kind="catalogImage"
                onBusyChange={icon.fieldProps.onBusyChange}
                onUploaded={icon.fieldProps.onUploaded}
                onCleared={icon.fieldProps.onCleared}
              />
            </UploadBox>
            {iconProblem ? <Alert type="error" title={iconProblem} showIcon /> : null}
          </Flex>
        </Form.Item>
        <Form.Item
          name="description"
          label={t('avatar.col.description')}
          extra={t('avatar.description.hint')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') throw new Error(t('avatar.description.required'));
              },
            },
          ]}
        >
          <Input.TextArea rows={2} dir="auto" />
        </Form.Item>
        <Form.Item
          name="generationSpec"
          label={t('avatar.col.generationSpec')}
          extra={t('avatar.spec.hint', { max: SPEC_MAX })}
          rules={[{ validator: specRule(t) }]}
        >
          <Input.TextArea rows={3} dir="auto" />
        </Form.Item>
        <Form.Item name="compatibleStyles" label={t('avatar.col.styles')}>
          <Checkbox.Group
            options={AVATAR_STYLES.map((style) => ({
              value: style,
              label: codeText(intl, 'avatar.style', style),
            }))}
          />
        </Form.Item>
        <Form.Item name="surfaces" label={t('avatar.col.surfaces')}>
          <SurfacesPicker />
        </Form.Item>
        <Form.Item name="triggerableBy" label={t('avatar.col.triggerableBy')}>
          <Select
            options={TRIGGERABLE_BY.map((by) => ({
              value: by,
              label: codeText(intl, 'avatar.triggerableBy', by),
            }))}
          />
        </Form.Item>
        {editing ? null : (
          <Form.Item name="enabled" label={t('avatar.col.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <Form.Item
          name="sortOrder"
          label={t('avatar.col.sortOrder')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                  throw new Error(t('avatar.sortOrder.whole'));
                }
              },
            },
          ]}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
