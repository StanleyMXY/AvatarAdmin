import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  createTaskConfig,
  TASK_TYPES,
  type TaskBody,
  type TaskConfig,
  type TaskType,
  updateTaskConfig,
} from '../../services/activity';
import { countCodePoints } from '../../utils/codePoints';
import { failureToForm } from '../../utils/failureToForm';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';

type Values = {
  taskName: string;
  taskType: TaskType | null;
  targetValue: number | null;
  rewardCredits: number | null;
  description: string;
  claimTimeoutSeconds: number | null;
  sortOrder: number | null;
};

type Props = {
  /** `'new'` for a new task, or the row being edited; it stays set while the dialog closes. `null` before the first opening. */
  target: 'new' | TaskConfig | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'taskName',
  'taskType',
  'targetValue',
  'rewardCredits',
  'description',
  'claimTimeoutSeconds',
  'sortOrder',
] as const;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const isWhole = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min;
const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * New or edit daily task. The target is at least 1 (fixed to 1 for the login task, in seconds for the
 * call task); the claim time is empty for "any time on the same day". A task that has records keeps
 * its type and target: the backend says so with TASK_HAS_RECORDS (a row that says `hasRecords` has
 * them read only from the start), and from then on the two fields show the old values and cannot change.
 */
export function TaskFormModal({ target, open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [lockedByBackend, setLockedByBackend] = useState(false);
  const row = target === null || target === 'new' ? null : target;
  const locked = lockedByBackend || (row as { hasRecords?: unknown } | null)?.hasRecords === true;
  const taskType = Form.useWatch('taskType', form);

  const initial: Values = useMemo(
    () =>
      row
        ? {
            taskName: plainText(row.taskName),
            taskType: (TASK_TYPES as readonly string[]).includes(plainText(row.taskType))
              ? row.taskType
              : null,
            targetValue: numberOrNull(row.targetValue),
            rewardCredits: numberOrNull(row.rewardCredits),
            description: plainText(row.description),
            claimTimeoutSeconds: numberOrNull(row.claimTimeoutSeconds),
            sortOrder: numberOrNull(row.sortOrder),
          }
        : {
            taskName: '',
            taskType: null,
            targetValue: 1,
            rewardCredits: 0,
            description: '',
            claimTimeoutSeconds: null,
            sortOrder: 0,
          },
    [row],
  );

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const type = values.taskType as TaskType;
    const body: TaskBody = {
      taskName: trimSpec(values.taskName),
      taskType: type,
      targetValue: type === 'daily_login' ? 1 : (values.targetValue as number),
      rewardCredits: values.rewardCredits as number,
      description: trimSpec(values.description ?? ''),
      claimTimeoutSeconds: values.claimTimeoutSeconds ?? null,
      sortOrder: values.sortOrder ?? 0,
    };
    try {
      if (row) await updateTaskConfig(row.id, body);
      else await createTaskConfig(body);
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      if (row && result.code === 'TASK_HAS_RECORDS') {
        // The backend refuses to change the type or the target: they go back to what the task has.
        setLockedByBackend(true);
        form.setFieldsValue({ taskType: initial.taskType, targetValue: initial.targetValue });
      } else {
        setFailure(result.text);
      }
      return;
    }
    message.success(t('activity.task.saved'));
    onSaved();
    onClose();
  });

  const whole = (min: number, text: string) => ({
    validator: async (_: unknown, value: unknown) => {
      if (!isWhole(value, min)) throw new Error(text);
    },
  });

  return (
    <Modal
      open={open && target !== null}
      title={t(row ? 'activity.task.form.editTitle' : 'activity.task.form.newTitle')}
      destroyOnHidden
      width={560}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="taskConfig"
        layout="vertical"
        requiredMark={false}
        initialValues={initial}
        onFinish={(values) => run(values)}
        onValuesChange={(changed: Partial<Values>) => {
          // The login task has no other target than 1.
          if (changed.taskType === 'daily_login') form.setFieldsValue({ targetValue: 1 });
        }}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="taskName"
          label={t('activity.task.form.name')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const length = countCodePoints(trimSpec(value ?? ''));
                if (length === 0) throw new Error(t('activity.task.form.nameRequired'));
                if (length > NAME_MAX) throw new Error(t('activity.task.form.nameTooLong'));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        {locked ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('activity.task.form.hasRecords')}
          />
        ) : null}
        <Form.Item
          name="taskType"
          label={t('activity.task.form.type')}
          extra={row && !locked ? t('activity.task.form.hasRecordsNote') : undefined}
          rules={[{ required: true, message: t('activity.task.form.typeRequired') }]}
        >
          <Select
            disabled={locked}
            options={TASK_TYPES.map((type) => ({
              value: type,
              label: t(`activity.task.type.${type}`),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="targetValue"
          label={t('activity.task.form.target')}
          extra={
            taskType === 'daily_login'
              ? t('activity.task.form.targetFixed')
              : taskType === 'call_seconds'
                ? t('activity.task.form.targetSeconds')
                : undefined
          }
          rules={[whole(1, t('activity.task.form.targetInvalid'))]}
        >
          <InputNumber
            min={1}
            step={1}
            precision={0}
            style={{ width: 160 }}
            disabled={locked || taskType === 'daily_login'}
          />
        </Form.Item>
        <Form.Item
          name="rewardCredits"
          label={t('activity.task.form.rewardCredits')}
          rules={[whole(0, t('activity.task.form.rewardInvalid'))]}
        >
          <InputNumber min={0} step={1} precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="description"
          label={t('activity.task.form.description')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (countCodePoints(trimSpec(value ?? '')) > DESCRIPTION_MAX) {
                  throw new Error(t('activity.task.form.descriptionTooLong'));
                }
              },
            },
          ]}
        >
          <Input.TextArea
            dir="auto"
            rows={4}
            showCount={{
              formatter: ({ value }) =>
                t('activity.task.form.descriptionCount', {
                  count: countCodePoints(trimSpec(value)),
                  max: DESCRIPTION_MAX,
                }),
            }}
          />
        </Form.Item>
        <Form.Item
          name="claimTimeoutSeconds"
          label={t('activity.task.form.claim')}
          extra={t('activity.task.form.claimHelp')}
          rules={[
            {
              validator: async (_, value: unknown) => {
                if (value !== null && value !== undefined && !isWhole(value, 1)) {
                  throw new Error(t('activity.task.form.claimInvalid'));
                }
              },
            },
          ]}
        >
          <InputNumber min={1} step={1} precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="sortOrder"
          label={t('activity.task.form.sortOrder')}
          rules={[
            {
              validator: async (_, value: unknown) => {
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                  throw new Error(t('activity.task.form.sortInvalid'));
                }
              },
            },
          ]}
        >
          <InputNumber step={1} precision={0} style={{ width: 160 }} />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
