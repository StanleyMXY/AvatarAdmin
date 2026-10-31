import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Typography } from 'antd';
import { useState } from 'react';
import { UploadField } from '../../components/UploadField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { createRendererModel, PLATFORMS, type Platform } from '../../services/avatar';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';
import { codeText } from './texts';
import { UploadBox } from './UploadBox';
import { useUploadSlot } from './uploadSlot';

type Values = {
  rendererKind: string;
  version: string;
  platform: Platform;
  abi: string;
  rendererFormatVersion: number | null;
  minVersionCode: number | null;
};

type Props = { open: boolean; onClose: () => void; onSaved: () => void };

/** The renderer kind of format 1 (contract 18); a later model brings its own kind. */
export const DEFAULT_RENDERER_KIND = 'AVATAR_RENDERER_V1';

const FIELDS = [
  'rendererKind',
  'version',
  'platform',
  'abi',
  'rendererFormatVersion',
  'minVersionCode',
] as const;

const required = (message: string) => async (_: unknown, value: string | undefined) => {
  if (trimSpec(value ?? '') === '') throw new Error(message);
};

/**
 * Register a renderer model: the zip goes up first (it cannot be sent while it is still going up),
 * then the form sends its id with the six fields. The size and the SHA-256 are the upload's and are not asked for.
 */
export function RendererModelModal({ open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const file = useUploadSlot();

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setFileProblem(null);
    if (!file.uploadId) {
      setFileProblem(t('avatar.models.fileRequired'));
      return;
    }
    try {
      await createRendererModel({
        uploadId: file.uploadId,
        rendererKind: trimSpec(values.rendererKind),
        version: trimSpec(values.version),
        platform: values.platform,
        abi: trimSpec(values.abi),
        rendererFormatVersion: values.rendererFormatVersion as number,
        minVersionCode: values.minVersionCode as number,
      });
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      if (result.uploadRejected) {
        file.reset();
        setFileProblem(t('avatar.models.fileRejected'));
      }
      setFailure(result.text);
      return;
    }
    message.success(t('avatar.models.saved'));
    onSaved();
    onClose();
  });

  const whole =
    (min: number, text: string) => async (_: unknown, value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
        throw new Error(text);
      }
    };

  return (
    <Modal
      open={open}
      title={t('avatar.models.new')}
      destroyOnHidden
      width={560}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        file.reset();
        setFailure(null);
        setFileProblem(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || file.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="rendererModel"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          rendererKind: DEFAULT_RENDERER_KIND,
          version: '',
          platform: 'ANDROID',
          abi: '',
          rendererFormatVersion: 1,
          minVersionCode: 0,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item label={t('avatar.models.file')} extra={t('avatar.models.fileHint')}>
          <UploadBox>
            <UploadField<{ uploadId: string }>
              kind="rendererModel"
              onBusyChange={file.fieldProps.onBusyChange}
              onUploaded={file.fieldProps.onUploaded}
              onCleared={file.fieldProps.onCleared}
            />
          </UploadBox>
          {fileProblem ? <Alert type="error" title={fileProblem} showIcon /> : null}
        </Form.Item>
        <Form.Item
          name="rendererKind"
          label={t('avatar.models.rendererKind')}
          rules={[{ validator: required(t('avatar.models.kindRequired')) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="version"
          label={t('avatar.models.version')}
          rules={[{ validator: required(t('avatar.models.versionRequired')) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="platform" label={t('avatar.models.platform')}>
          <Select
            options={PLATFORMS.map((platform) => ({
              value: platform,
              label: codeText(intl, 'avatar.platform', platform),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="abi"
          label={t('avatar.models.abi')}
          rules={[{ validator: required(t('avatar.models.abiRequired')) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="rendererFormatVersion"
          label={t('avatar.models.formatVersion')}
          rules={[{ validator: whole(1, t('avatar.models.formatVersionWhole')) }]}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Form.Item
          name="minVersionCode"
          label={t('avatar.models.minVersionCode')}
          rules={[{ validator: whole(0, t('avatar.models.minVersionCodeWhole')) }]}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          {t('avatar.models.derivedNote')}
        </Typography.Paragraph>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
