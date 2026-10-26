import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { ModerationDecision, ModerationRecord } from '../../services/moderation';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { effectKey } from './effects';

export const DECISION_NOTE_MAX = 500;

type Props = {
  record: ModerationRecord;
  /** Null while the dialog is closed. */
  decision: ModerationDecision | null;
  /** Sends the decision with the trimmed note (empty when there is none). A failure keeps the dialog open and is shown in it. */
  onSubmit: (decision: ModerationDecision, note: string) => Promise<void>;
  onClose: () => void;
};

/**
 * The confirmation of a decision: first what the decision does to this kind of content (contract
 * 11.4), then the note. The note is required to reject (at least one code point after the ends are
 * trimmed) and optional to approve. Pressing the button twice sends one request.
 */
export function DecisionModal({ record, decision, onSubmit, onClose }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<{ note: string }>();
  const [failure, setFailure] = useState<string | null>(null);
  const { run, pending } = useSingleFlight(async (chosen: ModerationDecision, note: string) => {
    setFailure(null);
    try {
      await onSubmit(chosen, note);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  });

  const rejecting = decision === 'REJECT';
  return (
    <Modal
      open={decision !== null}
      title={
        rejecting ? t('moderation.decision.rejectTitle') : t('moderation.decision.approveTitle')
      }
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={
        rejecting ? t('moderation.decision.confirmReject') : t('moderation.decision.confirmApprove')
      }
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending, danger: rejecting }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      {decision ? (
        <Alert
          type={rejecting ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          data-testid="moderation-effect"
          title={t('moderation.decision.consequence')}
          description={t(effectKey(record, decision))}
        />
      ) : null}
      <Form
        form={form}
        name="moderationDecision"
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => decision && run(decision, trimSpec(values.note ?? ''))}
      >
        <Form.Item
          name="note"
          label={
            rejecting ? t('moderation.decision.noteReject') : t('moderation.decision.noteApprove')
          }
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const length = countCodePoints(trimSpec(value ?? ''));
                if (rejecting && length === 0) {
                  throw new Error(t('moderation.decision.noteRequired'));
                }
                if (length > DECISION_NOTE_MAX) {
                  throw new Error(t('moderation.decision.noteLength', { max: DECISION_NOTE_MAX }));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={4} autoFocus />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
