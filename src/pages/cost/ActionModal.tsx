import { useIntl } from '@umijs/max';
import { Alert, Modal } from 'antd';
import { type ReactNode, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { failureLines } from './failure';

type Props = {
  open: boolean;
  title: ReactNode;
  okText: ReactNode;
  /** What the action does, written before anything is sent. */
  children: ReactNode;
  okDisabled?: boolean;
  /** Does the write. A rejection stays in the dialog as text; the caller closes the dialog on success. */
  onSubmit: () => Promise<void>;
  onClose: () => void;
};

/**
 * The dialog that says what a write does and asks for the go-ahead. The button works once while the
 * request runs; a refusal keeps the dialog open and shows the words of the error code and of the
 * reasons, never the backend's own words.
 */
export function ActionModal({
  open,
  title,
  okText,
  children,
  okDisabled,
  onSubmit,
  onClose,
}: Props) {
  const intl = useIntl();
  const [failure, setFailure] = useState<{ text: string; reasons: string[] } | null>(null);
  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    try {
      await onSubmit();
    } catch (error) {
      setFailure(failureLines(intl, error));
    }
  });
  return (
    <Modal
      open={open}
      title={title}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => setFailure(null)}
      okText={okText}
      cancelText={intl.formatMessage({ id: 'pages.common.cancel' })}
      okButtonProps={{ loading: pending, disabled: pending || okDisabled }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => void run()}
    >
      {children}
      {failure ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12 }}
          title={failure.text}
          description={
            failure.reasons.length > 0
              ? failure.reasons.map((r) => <div key={r}>{r}</div>)
              : undefined
          }
        />
      ) : null}
    </Modal>
  );
}
