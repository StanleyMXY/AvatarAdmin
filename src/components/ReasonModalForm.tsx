import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal } from 'antd';
import { type ReactNode, useState } from 'react';
import { RevalidateOnLocaleChange } from '../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { describeFailure } from '../session/describe';
import { countCodePoints } from '../utils/codePoints';
import { trimSpec } from '../utils/trimSpec';

type Props = {
  open: boolean;
  title: ReactNode;
  reasonLabel?: ReactNode;
  /** Shortest and longest reason in code points after the ends are trimmed (default 1 to 500). */
  min?: number;
  max?: number;
  /** Text under the box, for example "this is written to the user and has one language only". */
  hint?: ReactNode;
  /** Sends the reason (already trimmed). A failure keeps the dialog open and is shown in it. */
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
};

/**
 * The dialog that asks for a reason before a write (ban, reject, grant, reset ...). The reason is
 * trimmed with the contract's whitespace set and counted in code points, as the server counts it.
 */
export function ReasonModalForm({
  open,
  title,
  reasonLabel,
  min = 1,
  max = 500,
  hint,
  onSubmit,
  onClose,
}: Props) {
  const intl = useIntl();
  const [form] = Form.useForm<{ reason: string }>();
  const [failure, setFailure] = useState<string | null>(null);
  const { run, pending } = useSingleFlight(async (reason: string) => {
    setFailure(null);
    try {
      await onSubmit(reason);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  });

  const validate = async (_: unknown, value: string | undefined) => {
    const length = countCodePoints(trimSpec(value ?? ''));
    if (length === 0) throw new Error(intl.formatMessage({ id: 'pages.common.reasonRequired' }));
    if (length < min || length > max) {
      throw new Error(intl.formatMessage({ id: 'pages.common.reasonLength' }, { min, max }));
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={intl.formatMessage({ id: 'pages.common.submit' })}
      cancelText={intl.formatMessage({ id: 'pages.common.cancel' })}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => run(trimSpec(values.reason))}
        requiredMark={false}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="reason"
          label={reasonLabel ?? intl.formatMessage({ id: 'pages.common.reasonLabel' })}
          extra={hint}
          rules={[{ validator: validate }]}
        >
          <Input.TextArea rows={4} autoFocus />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
