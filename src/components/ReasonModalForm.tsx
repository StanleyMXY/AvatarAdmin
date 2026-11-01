import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal } from 'antd';
import { type ReactNode, useRef, useState } from 'react';
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
  // The failure itself, not its words: they are written when drawn, so they follow a language switch.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  // The body of a dialog that is closing is not drawn again, so what its handlers read has to be a
  // ref: the props they were drawn with are those of the last time the dialog was open.
  const isOpen = useRef(open);
  isOpen.current = open;
  const { run, pending } = useSingleFlight(async (reason: string) => {
    setFailure(null);
    try {
      await onSubmit(reason);
    } catch (error) {
      setFailure({ error });
    }
  });

  const described = failure ? describeFailure(intl, failure.error) : null;
  // What each field was refused for, each reason once.
  const reasons = [...new Set(described?.fields.map((field) => field.text) ?? [])];

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
        // A dialog that is closing (its parent closed it after the submit went through) sends nothing.
        onFinish={(values) => (isOpen.current ? run(trimSpec(values.reason)) : undefined)}
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
        {described ? (
          <Alert
            type="error"
            title={described.text}
            description={reasons.length > 0 ? reasons.join(' ') : undefined}
            showIcon
          />
        ) : null}
      </Form>
    </Modal>
  );
}
