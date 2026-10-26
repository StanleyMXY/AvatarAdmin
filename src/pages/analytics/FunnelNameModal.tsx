import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { describeFailure } from '../../session/describe';
import { useSubmitOnce } from '../../session/useSubmitOnce';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

/** Longest name of a saved funnel. The contract does not say; this is the provisional limit. */
export const FUNNEL_NAME_MAX = 100;

type Props = {
  title: string;
  initialName: string;
  /** Saves under the (trimmed) name; a rejection is shown in the dialog, which stays open. */
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
};

/** The dialog that asks for the name of a funnel (save as, edit). */
export function FunnelNameModal({ title, initialName, onSubmit, onCancel }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<{ name: string }>();
  const { busy, run } = useSubmitOnce();
  const [failure, setFailure] = useState<string | null>(null);

  const submit = () => {
    void run(async () => {
      let name: string;
      try {
        name = trimSpec((await form.validateFields()).name ?? '');
      } catch {
        return; // the field says what is wrong
      }
      setFailure(null);
      try {
        await onSubmit(name);
      } catch (error) {
        setFailure(describeFailure(intl, error).text);
      }
    });
  };

  return (
    <Modal
      open
      title={title}
      okText={t('analytics.funnel.dialog.save')}
      cancelText={t('pages.common.cancel')}
      onOk={submit}
      onCancel={busy ? undefined : onCancel}
      okButtonProps={{ loading: busy, disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: false }}
    >
      <Typography.Paragraph type="secondary">
        {t('analytics.funnel.dialog.hint')}
      </Typography.Paragraph>
      <Form form={form} layout="vertical" initialValues={{ name: initialName }} onFinish={submit}>
        <Form.Item
          label={t('analytics.funnel.dialog.name')}
          name="name"
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const name = trimSpec(value ?? '');
                if (name === '') throw new Error(t('analytics.funnel.dialog.nameRequired'));
                if (countCodePoints(name) > FUNNEL_NAME_MAX) {
                  throw new Error(
                    t('analytics.funnel.dialog.nameLength', { max: FUNNEL_NAME_MAX }),
                  );
                }
              },
            },
          ]}
        >
          <Input autoFocus dir="auto" />
        </Form.Item>
      </Form>
      {failure ? <Alert type="error" showIcon title={failure} /> : null}
    </Modal>
  );
}
