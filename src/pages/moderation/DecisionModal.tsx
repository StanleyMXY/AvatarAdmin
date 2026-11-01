import { useIntl } from '@umijs/max';
import { Alert, Form, Input, Modal } from 'antd';
import { useRef, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import {
  MODERATION_STATUSES,
  type ModerationDecision,
  type ModerationRecord,
} from '../../services/moderation';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { effectKey } from './effects';
import { labelOf } from './options';

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
  // The body of a dialog that is closing is not drawn again, so its handlers read the decision from
  // a ref: a press on the button while it fades out must not send the decision a second time.
  const current = useRef(decision);
  current.current = decision;
  const { run, pending } = useSingleFlight(async (chosen: ModerationDecision, note: string) => {
    setFailure(null);
    try {
      await onSubmit(chosen, note);
    } catch (error) {
      setFailure(failureText(error));
    }
  });

  // The record is shown again after a 409; once it is no longer waiting there is nothing to confirm.
  const stillPending = record.status === 'PENDING_REVIEW';

  /** A 409 says the state the record is in now (`data.status`); any other failure is told by its code. */
  function failureText(error: unknown): string {
    if (error instanceof ApiError && error.code === 'INVALID_STATE') {
      const status = (error.data as { status?: unknown } | null)?.status;
      if (
        typeof status === 'string' &&
        (MODERATION_STATUSES as readonly string[]).includes(status)
      ) {
        return t('moderation.decision.stateChanged', {
          status: labelOf(t, intl.messages, 'moderation.status', status),
        });
      }
    }
    return describeFailure(intl, error).text;
  }

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
      okButtonProps={{ loading: pending, disabled: pending || !stillPending, danger: rejecting }}
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
        onFinish={(values) =>
          current.current ? run(current.current, trimSpec(values.note ?? '')) : undefined
        }
      >
        <RevalidateOnLocaleChange />
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
