import { useIntl } from '@umijs/max';
import { Alert, App, Checkbox, Form, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import { UploadField } from '../../components/UploadField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { AVATAR_STYLES, type AvatarStyle, createDefaultAvatar } from '../../services/avatar';
import { trimSpec } from '../../utils/trimSpec';
import { nameProblem } from './avatarName';
import { failureToForm } from './formFailure';
import { codeText } from './texts';
import { UploadBox } from './UploadBox';
import { useUploadSlot } from './uploadSlot';

type Values = { name: string; style: AvatarStyle | undefined; authorized: boolean };

type Props = { open: boolean; onClose: () => void; onSaved: () => void };

/**
 * New default avatar: the source picture goes up first; the form asks for a name and a style and
 * for the confirmation that the picture has a portrait licence or is synthetic. The confirmation
 * is only for the screen: it is not sent. The result is a DRAFT that still has to be generated.
 */
export function NewDefaultAvatarModal({ open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [sourceProblem, setSourceProblem] = useState<string | null>(null);
  const source = useUploadSlot();

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setSourceProblem(null);
    if (!source.uploadId) {
      setSourceProblem(t('avatar.defaults.sourceRequired'));
      return;
    }
    try {
      await createDefaultAvatar({
        name: trimSpec(values.name),
        style: values.style as AvatarStyle,
        sourceUploadId: source.uploadId,
      });
    } catch (error) {
      const result = failureToForm(intl, form, error, ['name', 'style']);
      if (result.uploadRejected) {
        source.reset();
        setSourceProblem(t('avatar.defaults.sourceRejected'));
      }
      setFailure(result.text);
      return;
    }
    message.success(t('avatar.defaults.created'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t('avatar.defaults.new')}
      destroyOnHidden
      width={560}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        source.reset();
        setFailure(null);
        setSourceProblem(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || source.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="newDefaultAvatar"
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: '', style: undefined, authorized: false }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item label={t('avatar.defaults.source')} extra={t('avatar.defaults.sourceHint')}>
          <UploadBox>
            <UploadField<{ uploadId: string }>
              kind="defaultAvatarSource"
              onBusyChange={source.fieldProps.onBusyChange}
              onUploaded={source.fieldProps.onUploaded}
              onCleared={source.fieldProps.onCleared}
            />
          </UploadBox>
          {sourceProblem ? <Alert type="error" title={sourceProblem} showIcon /> : null}
        </Form.Item>
        <Form.Item
          name="name"
          label={t('avatar.defaults.name')}
          extra={t('avatar.defaults.nameHint')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const problem = nameProblem(value);
                if (problem) throw new Error(t(`avatar.defaults.nameProblem.${problem}`));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="style"
          label={t('avatar.defaults.style')}
          rules={[{ required: true, message: t('avatar.defaults.styleRequired') }]}
        >
          <Select
            options={AVATAR_STYLES.map((style) => ({
              value: style,
              label: codeText(intl, 'avatar.style', style),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="authorized"
          valuePropName="checked"
          rules={[
            {
              validator: async (_, value: boolean | undefined) => {
                if (value !== true) throw new Error(t('avatar.defaults.authorizedRequired'));
              },
            },
          ]}
        >
          <Checkbox>{t('avatar.defaults.authorized')}</Checkbox>
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
