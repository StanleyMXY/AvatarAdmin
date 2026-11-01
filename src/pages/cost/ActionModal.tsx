import { useIntl } from '@umijs/max';
import { Alert, Modal } from 'antd';
import type { ReactNode } from 'react';
import { useFailureView } from '../../hooks/useFailure';
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
  /** Words (language-file keys) for a refused field, by its `ref`, instead of the words of its reason. */
  refTexts?: Record<string, string>;
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
  refTexts,
}: Props) {
  const intl = useIntl();
  const { view: failure, show, clear } = useFailureView<{ text: string; reasons: string[] }>();
  const { run, pending } = useSingleFlight(async () => {
    clear();
    try {
      await onSubmit();
    } catch (error) {
      show((words) => failureLines(words, error, refTexts));
    }
  });
  return (
    <Modal
      open={open}
      title={title}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={clear}
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
