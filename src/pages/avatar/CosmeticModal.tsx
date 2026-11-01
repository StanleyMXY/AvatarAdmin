import { useIntl } from '@umijs/max';
import { Alert, App, Checkbox, Flex, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useState } from 'react';
import { UploadField } from '../../components/UploadField';
import { useFailure } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { useUploadSlot } from '../../hooks/useUploadSlot';
import {
  AVATAR_STYLES,
  type AvatarStyle,
  COSMETIC_KINDS,
  type CosmeticItem,
  type CosmeticKind,
  createCosmetic,
  type Surface,
  updateCosmetic,
} from '../../services/avatar';
import { countCodePoints } from '../../utils/codePoints';
import { codeText } from '../../utils/displayText';
import { failureToForm } from '../../utils/failureToForm';
import { trimSpec } from '../../utils/trimSpec';
import { LocalizedTextsField } from './LocalizedTextsField';
import { cleanTexts, type Texts } from './localized';
import { SurfacesPicker } from './SurfacesPicker';
import { Thumb } from './Thumb';

type Values = {
  key: string;
  kind: CosmeticKind;
  names: Texts;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  creditPrice: number | null;
  isFree: boolean;
  isDefault: boolean;
  sortOrder: number | null;
  enabled: boolean;
};

type Props = {
  open: boolean;
  /** The item being edited; none means a new item. */
  item: CosmeticItem | null;
  onClose: () => void;
  onSaved: () => void;
};

export const SPEC_MAX = 2000;
const FIELDS = [
  'key',
  'kind',
  'names',
  'generationSpec',
  'compatibleStyles',
  'surfaces',
  'creditPrice',
  'isFree',
  'isDefault',
  'sortOrder',
  'enabled',
] as const;

/** The generation text must be 1 to 2000 code points after the ends are trimmed with the contract's set. */
export function specRule(t: (id: string, values?: Record<string, number>) => string) {
  return async (_: unknown, value: string | undefined) => {
    const length = countCodePoints(trimSpec(value ?? ''));
    if (length === 0) throw new Error(t('avatar.spec.required'));
    if (length > SPEC_MAX) throw new Error(t('avatar.spec.length', { max: SPEC_MAX }));
  };
}

/** New or edit cosmetic. The key and the kind are fixed once the item exists; the picture goes up first and only its id is sent. */
export function CosmeticModal({ open, item, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { text: failure, fail, clear } = useFailure();
  // The language-file key of the problem, not its words: the words are made when drawn.
  const [pictureProblem, setPictureProblem] = useState<string | null>(null);
  const picture = useUploadSlot();
  const editing = item !== null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    setPictureProblem(null);
    if (!editing && !picture.uploadId) {
      setPictureProblem('avatar.preview.required');
      return;
    }
    const fields = {
      names: cleanTexts(values.names),
      generationSpec: trimSpec(values.generationSpec),
      compatibleStyles: values.compatibleStyles ?? [],
      surfaces: values.surfaces ?? [],
      creditPrice: values.creditPrice ?? null,
      isFree: values.isFree,
      isDefault: values.isDefault,
      sortOrder: values.sortOrder ?? 0,
      ...(picture.uploadId ? { previewUploadId: picture.uploadId } : {}),
    };
    try {
      if (item) {
        await updateCosmetic(item.id, fields);
      } else {
        await createCosmetic({
          ...fields,
          key: trimSpec(values.key),
          kind: values.kind,
          enabled: values.enabled,
        });
      }
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      if (result.uploadRejected) {
        picture.reset();
        setPictureProblem('avatar.preview.rejected');
      }
      fail(error);
      return;
    }
    message.success(t('avatar.cosmetics.saved'));
    onSaved();
    onClose();
  });

  const whole = async (_: unknown, value: number | null | undefined) => {
    if (value === null || value === undefined) return;
    if (!Number.isInteger(value) || value < 0) throw new Error(t('avatar.cosmetics.priceWhole'));
  };

  return (
    <Modal
      open={open}
      title={t(editing ? 'avatar.cosmetics.edit' : 'avatar.cosmetics.new')}
      destroyOnHidden
      width={640}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        picture.reset();
        clear();
        setPictureProblem(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || picture.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="cosmetic"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          key: item?.key ?? '',
          kind: item?.kind ?? 'OUTFIT',
          names: item?.names ?? {},
          generationSpec: item?.generationSpec ?? '',
          compatibleStyles: item?.compatibleStyles ?? ['STYLIZED_3D'],
          surfaces: item?.surfaces ?? [],
          creditPrice: item?.creditPrice ?? null,
          isFree: item?.isFree ?? false,
          isDefault: item?.isDefault ?? false,
          sortOrder: item?.sortOrder ?? 0,
          enabled: item?.enabled ?? false,
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
        <Form.Item name="kind" label={t('avatar.cosmetics.kind')}>
          <Select
            disabled={editing}
            options={COSMETIC_KINDS.map((kind) => ({
              value: kind,
              label: codeText(intl, 'avatar.cosmetics.kind', kind),
            }))}
          />
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
        <Form.Item label={t('avatar.col.preview')}>
          <Flex vertical gap={8}>
            {item ? <Thumb url={item.previewUrl} alt={item.key} size={64} /> : null}
            <UploadField<{ uploadId: string }>
              kind="catalogImage"
              onBusyChange={picture.fieldProps.onBusyChange}
              onUploaded={picture.fieldProps.onUploaded}
              onCleared={picture.fieldProps.onCleared}
            />
            {pictureProblem ? <Alert type="error" title={t(pictureProblem)} showIcon /> : null}
          </Flex>
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
        <Form.Item
          name="creditPrice"
          label={t('avatar.col.creditPrice')}
          extra={t('avatar.creditPrice.hint')}
          rules={[{ validator: whole }]}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Flex gap={24} wrap>
          <Form.Item name="isFree" label={t('avatar.col.isFree')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="isDefault"
            label={t('avatar.col.isDefault')}
            valuePropName="checked"
            extra={t('avatar.isDefault.hint')}
          >
            <Switch />
          </Form.Item>
          {editing ? null : (
            <Form.Item name="enabled" label={t('avatar.col.enabled')} valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Flex>
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
