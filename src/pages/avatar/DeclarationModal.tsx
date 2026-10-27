import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { createDeclaration } from '../../services/avatar';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';
import { LocalizedTextsField } from './LocalizedTextsField';
import { cleanTexts, type Texts } from './localized';

type Values = { version: string; texts: Texts };

type Props = { open: boolean; onClose: () => void; onSaved: () => void };

const FIELDS = ['version', 'texts'] as const;

/** A new version of the upload declaration, with its text in every language the lawyer has written it in. It is not active until it is set active. */
export function DeclarationModal({ open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    try {
      await createDeclaration({
        version: trimSpec(values.version),
        texts: cleanTexts(values.texts),
      });
    } catch (error) {
      setFailure(failureToForm(intl, form, error, FIELDS).text);
      return;
    }
    message.success(t('avatar.declarations.saved'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t('avatar.declarations.new')}
      destroyOnHidden
      width={640}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="declaration"
        layout="vertical"
        requiredMark={false}
        initialValues={{ version: '', texts: {} }}
        onFinish={(values) => run(values)}
      >
        <Form.Item
          name="version"
          label={t('avatar.declarations.version')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') {
                  throw new Error(t('avatar.declarations.versionRequired'));
                }
              },
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="texts"
          label={t('avatar.declarations.texts')}
          extra={t('avatar.declarations.textsHint')}
          rules={[
            {
              validator: async (_, value: Texts | undefined) => {
                if (Object.keys(cleanTexts(value)).length === 0) {
                  throw new Error(t('avatar.declarations.textsRequired'));
                }
              },
            },
          ]}
        >
          <LocalizedTextsField multiline />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
