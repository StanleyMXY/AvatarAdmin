import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

const NOTE_MAX = 500;

type Props = {
  open: boolean;
  /** Sends the approval with the note (already trimmed; empty when there is none). A failure keeps the dialog open. */
  onSubmit: (note: string) => Promise<void>;
  onClose: () => void;
};

/** 通过: an approval takes a note that is optional (the rejection note is required, that is `ReasonModalForm`). */
export function ApproveModal({ open, onSubmit, onClose }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<{ note: string }>();
  const [failure, setFailure] = useState<string | null>(null);
  const { run, pending } = useSingleFlight(async (note: string) => {
    setFailure(null);
    try {
      await onSubmit(note);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  });

  return (
    <Modal
      open={open}
      title={t('credits.requests.approveTitle')}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={t('credits.requests.approve')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="approveRequest"
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => run(trimSpec(values.note ?? ''))}
      >
        <Form.Item
          name="note"
          label={t('credits.requests.approveNote')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (countCodePoints(trimSpec(value ?? '')) > NOTE_MAX) {
                  throw new Error(t('pages.common.reasonLength', { min: 1, max: NOTE_MAX }));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
