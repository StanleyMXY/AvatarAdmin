import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useFailure } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type AdjustKind, createAdjustRequest } from '../../services/credits';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

type Values = { accountId: string; kind: AdjustKind; delta: number | null; reason: string };

type Props = {
  open: boolean;
  /** Fixes the account (the user detail opens the dialog for the account it shows). */
  accountId?: string;
  onClose: () => void;
  onCreated: () => void;
};

const FIELDS = ['accountId', 'kind', 'delta', 'reason'] as const;
const REASON_MAX = 500;

/**
 * 新建申请 (`SUBSCRIPTION:GRANT`): account id, type, credits and reason. A grant needs a positive
 * whole number; an adjustment may be positive or negative but not zero, and a negative one can take
 * the balance below zero. The request waits for another administrator (`CREDIT:REVIEW`) to approve it.
 */
export function AdjustRequestModal({ open, accountId, onClose, onCreated }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { text: failure, fail, clear } = useFailure();

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    try {
      await createAdjustRequest({
        accountId: trimSpec(values.accountId),
        kind: values.kind,
        delta: values.delta as number,
        reason: trimSpec(values.reason),
      });
    } catch (error) {
      const { fields } = describeFailure(intl, error);
      const mine = fields.filter((f) => (FIELDS as readonly string[]).includes(f.ref));
      if (mine.length > 0) {
        form.setFields(mine.map((f) => ({ name: f.ref as keyof Values, errors: [f.text] })));
      }
      fail(error);
      return;
    }
    message.success(t('credits.requests.created'));
    onCreated();
    onClose();
  });

  const validateAccount = async (_: unknown, value: string | undefined) => {
    if (trimSpec(value ?? '') === '') throw new Error(t('credits.form.accountRequired'));
  };
  const validateDelta = async (_: unknown, value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(t('credits.form.deltaWhole'));
    }
    if (form.getFieldValue('kind') === 'GRANT' ? value <= 0 : value === 0) {
      throw new Error(
        t(
          form.getFieldValue('kind') === 'GRANT'
            ? 'credits.form.deltaPositive'
            : 'credits.form.deltaNonzero',
        ),
      );
    }
  };
  const validateReason = async (_: unknown, value: string | undefined) => {
    const length = countCodePoints(trimSpec(value ?? ''));
    if (length === 0) throw new Error(t('pages.common.reasonRequired'));
    if (length > REASON_MAX) {
      throw new Error(t('pages.common.reasonLength', { min: 1, max: REASON_MAX }));
    }
  };

  return (
    <Modal
      open={open}
      title={t('credits.requests.new')}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        clear();
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="adjustRequest"
        layout="vertical"
        requiredMark={false}
        initialValues={{ accountId: accountId ?? '', kind: 'GRANT', delta: null, reason: '' }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="accountId"
          label={t('credits.common.accountId')}
          rules={[{ validator: validateAccount }]}
        >
          <Input disabled={accountId !== undefined} />
        </Form.Item>
        <Form.Item name="kind" label={t('credits.requests.kind')}>
          <Select
            options={[
              { value: 'GRANT', label: t('credits.kind.GRANT') },
              { value: 'ADJUST', label: t('credits.kind.ADJUST') },
            ]}
            onChange={() => {
              if (form.isFieldTouched('delta')) void form.validateFields(['delta']).catch(() => {});
            }}
          />
        </Form.Item>
        <Form.Item
          name="delta"
          label={t('credits.requests.delta')}
          dependencies={['kind']}
          rules={[{ validator: validateDelta }]}
          extra={t('credits.form.deltaHint')}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('credits.requests.reason')}
          rules={[{ validator: validateReason }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
