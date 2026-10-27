import { useIntl } from '@umijs/max';
import { Alert, App, Flex, Form, Input, InputNumber, Modal } from 'antd';
import { useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import { MEMORY_NAME_PATTERN, registerEmbeddingModel } from '../../services/memory';
import { describeFailure } from '../../session/describe';
import { trimSpec } from '../../utils/trimSpec';

type Values = { modelName?: string; teiBaseUrl?: string; dimensions?: number | null };

type Props = { open: boolean; onClose: () => void; onSaved: () => void };

/** What the form refuses before anything is sent: the backend checks the same and has the last word. */
const addressProblem = (text: string): boolean => {
  try {
    const url = new URL(text);
    return (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== ''
    );
  } catch {
    return true;
  }
};

/**
 * What a 409 MEMORY_MODEL_CONFLICT says: the sentence of the memory service (`data.detail`) as it
 * is, because it names the dimensions the model was registered with.
 */
const conflictDetail = (error: unknown): string | null => {
  if (!(error instanceof ApiError) || error.code !== 'MEMORY_MODEL_CONFLICT') return null;
  const detail = (error.data as { detail?: unknown } | null)?.detail;
  return typeof detail === 'string' && detail !== '' ? detail : null;
};

/** Registers an embedding model. The TEI container has to be running first, which the dialog says. */
export function ModelForm({ open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);

  const send = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const name = trimSpec(values.modelName ?? '');
    try {
      await registerEmbeddingModel(name, {
        teiBaseUrl: trimSpec(values.teiBaseUrl ?? ''),
        dimensions: values.dimensions as number,
      });
    } catch (error) {
      const detail = conflictDetail(error);
      if (detail !== null) {
        setFailure(detail);
        return;
      }
      const { text, fields } = describeFailure(intl, error);
      const byRef: Record<string, string> = { name: 'modelName' };
      const placed = fields.filter((f) => ['name', 'teiBaseUrl', 'dimensions'].includes(f.ref));
      if (placed.length > 0) {
        form.setFields(
          placed.map((f) => ({ name: (byRef[f.ref] ?? f.ref) as keyof Values, errors: [f.text] })),
        );
      } else {
        setFailure(text);
      }
      return;
    }
    message.success(t('memory.model.registered'));
    onSaved();
  });

  return (
    <Modal
      open={open}
      title={t('memory.model.registerTitle')}
      destroyOnHidden
      mask={{ closable: false }}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      onCancel={send.pending ? undefined : onClose}
      okText={t('memory.model.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: send.pending, disabled: send.pending }}
      cancelButtonProps={{ disabled: send.pending }}
      onOk={() => form.submit()}
    >
      <Flex vertical gap={12}>
        <Alert type="warning" showIcon title={t('memory.model.startTeiFirst')} />
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => send.run(values)}
        >
          <RevalidateOnLocaleChange />
          <Form.Item
            name="modelName"
            label={t('memory.model.name')}
            extra={t('memory.model.nameHelp')}
            rules={[
              {
                validator: async (_, value) => {
                  if (!MEMORY_NAME_PATTERN.test(trimSpec(String(value ?? '')))) {
                    throw new Error(t('memory.model.nameInvalid'));
                  }
                },
              },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="teiBaseUrl"
            label={t('memory.model.teiBaseUrl')}
            extra={t('memory.model.teiBaseUrlHelp')}
            rules={[
              {
                validator: async (_, value) => {
                  if (addressProblem(trimSpec(String(value ?? '')))) {
                    throw new Error(t('memory.model.teiBaseUrlInvalid'));
                  }
                },
              },
            ]}
          >
            <Input autoComplete="off" placeholder={t('pages.link.target.placeholderUrl')} />
          </Form.Item>
          <Form.Item
            name="dimensions"
            label={t('memory.model.dimensions')}
            extra={t('memory.model.dimensionsHelp')}
            rules={[
              {
                validator: async (_, value) => {
                  if (
                    typeof value !== 'number' ||
                    !Number.isInteger(value) ||
                    value < 1 ||
                    value > 8192
                  ) {
                    throw new Error(t('memory.model.dimensionsInvalid'));
                  }
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        {failure ? (
          <Alert type="error" showIcon title={failure} style={{ overflowWrap: 'anywhere' }} />
        ) : null}
      </Flex>
    </Modal>
  );
}
