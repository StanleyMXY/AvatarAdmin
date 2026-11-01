import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Spin,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type ActivityBody,
  type CheckinActivity,
  type CheckinActivityDetail,
  createCheckinActivity,
  getCheckinActivity,
  updateCheckinActivity,
} from '../../services/activity';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { failureToForm } from '../../utils/failureToForm';
import { trimSpec } from '../../utils/trimSpec';
import { pickedDay } from '../../utils/utcDay';
import { useOverlapFlow } from './useOverlapFlow';

type StepValues = { rewardCredits: number | null; bonusCredits: number | null };
type Values = {
  name: string;
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  rewards: StepValues[];
};

type Props = {
  /** `'new'` for a new activity, or the row being edited; it stays set while the dialog closes. `null` before the first opening. */
  target: 'new' | CheckinActivity | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['name', 'startDate', 'endDate', 'rewards'] as const;

const dayOf = (text: string | null | undefined): Dayjs | null => {
  const picked = text ? dayjs(`${text}T00:00:00`) : null;
  return picked?.isValid() ? picked : null;
};

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * New or edit sign-in activity: the name, the days (the users' local days, empty is no limit) and the
 * steps ("Day N" is the position of the row). Editing reads the steps first. Saving the days of a live
 * activity goes through the overlap question; every other save is one request.
 */
export function ActivityFormModal({ target, open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const probe = useOverlapFlow();
  const [failure, setFailure] = useState<string | null>(null);
  const row = target === null || target === 'new' ? null : target;
  const rowId = row?.id ?? null;

  // ---- the steps of the activity being edited ----
  const [detail, setDetail] = useState<CheckinActivityDetail | null>(null);
  // The failed request is kept, not its text: the text is written when drawn, so a language switch
  // changes it without reading the activity again (which would empty the form being typed in).
  const [loadFailure, setLoadFailure] = useState<{ failure: unknown } | null>(null);
  const begin = useLatestCall();
  const load = useCallback(
    async (id: string) => {
      const isCurrent = begin();
      setDetail(null);
      setLoadFailure(null);
      try {
        const answer = await getCheckinActivity(id);
        if (isCurrent()) setDetail(answer);
      } catch (error) {
        if (isCurrent()) setLoadFailure({ failure: error });
      }
    },
    [begin],
  );
  useEffect(() => {
    if (rowId === null) {
      // Closed, or a new activity: an answer that is still on its way belongs to nobody.
      begin();
      setDetail(null);
      setLoadFailure(null);
      return;
    }
    void load(rowId);
  }, [rowId, load, begin]);

  const ready = target === 'new' || (row !== null && detail !== null && detail.id === row.id);

  const initial: Values = useMemo(() => {
    if (!detail) {
      return {
        name: '',
        startDate: null,
        endDate: null,
        rewards: [{ rewardCredits: null, bonusCredits: 0 }],
      };
    }
    const steps = Array.isArray(detail.rewards) ? [...detail.rewards] : [];
    steps.sort((a, b) => a.dayNum - b.dayNum);
    return {
      name: typeof detail.name === 'string' ? detail.name : '',
      startDate: dayOf(detail.startDate),
      endDate: dayOf(detail.endDate),
      rewards:
        steps.length > 0
          ? steps.map((s) => ({ rewardCredits: s.rewardCredits, bonusCredits: s.bonusCredits }))
          : [{ rewardCredits: null, bonusCredits: 0 }],
    };
  }, [detail]);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const body: ActivityBody = {
      name: trimSpec(values.name),
      startDate: values.startDate ? pickedDay(values.startDate) : null,
      endDate: values.endDate ? pickedDay(values.endDate) : null,
      rewards: values.rewards.map((step, index) => ({
        dayNum: index + 1,
        rewardCredits: step.rewardCredits ?? 0,
        bonusCredits: step.bonusCredits ?? 0,
      })),
    };
    const show = (error: unknown) => setFailure(failureToForm(intl, form, error, FIELDS).text);
    if (detail && row) {
      const rangeChanged = body.startDate !== detail.startDate || body.endDate !== detail.endDate;
      // The state read when the dialog opened decides, not the row of the list (it can be older).
      let probeFirst = detail.status === 'ACTIVE' && rangeChanged;
      if (!probeFirst) {
        try {
          const reply = await updateCheckinActivity(row.id, body);
          // The backend did not apply it (the activity went live meanwhile): ask the overlap question.
          probeFirst =
            typeof reply === 'object' &&
            reply !== null &&
            (reply as { applied?: unknown }).applied === false;
        } catch (error) {
          show(error);
          return;
        }
      }
      if (probeFirst) {
        const outcome = await probe('update', row.id, body);
        if (outcome.kind === 'cancelled') return;
        if (outcome.kind === 'failed') {
          show(outcome.error);
          return;
        }
      }
    } else {
      try {
        await createCheckinActivity(body);
      } catch (error) {
        show(error);
        return;
      }
    }
    message.success(t('activity.signin.saved'));
    onSaved();
    onClose();
  });

  const creditsRule = {
    validator: async (_: unknown, value: unknown) => {
      if (!isWhole(value)) throw new Error(t('activity.signin.form.creditsInvalid'));
    },
  };

  return (
    <Modal
      open={open && target !== null}
      title={t(row ? 'activity.signin.form.editTitle' : 'activity.signin.form.newTitle')}
      destroyOnHidden
      width={560}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || !ready }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      {!ready && !loadFailure ? <Spin /> : null}
      {loadFailure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', {
            message: describeFailure(intl, loadFailure.failure).text,
          })}
          action={
            <Button size="small" onClick={() => rowId !== null && void load(rowId)}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {ready ? (
        <Form
          key={detail?.id ?? 'new'}
          form={form}
          name="checkinActivity"
          layout="vertical"
          requiredMark={false}
          initialValues={initial}
          onFinish={(values) => run(values)}
        >
          <RevalidateOnLocaleChange />
          <Typography.Paragraph type="secondary">{t('activity.signin.note')}</Typography.Paragraph>
          {row?.status === 'ACTIVE' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('activity.signin.form.liveNote')}
            />
          ) : null}
          <Form.Item
            name="name"
            label={t('activity.signin.form.name')}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (countCodePoints(trimSpec(value ?? '')) === 0) {
                    throw new Error(t('activity.signin.form.nameRequired'));
                  }
                },
              },
            ]}
          >
            <Input dir="auto" />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="startDate" label={t('activity.signin.form.startDate')}>
              <DatePicker format="YYYY-MM-DD" allowClear />
            </Form.Item>
            <Form.Item
              name="endDate"
              label={t('activity.signin.form.endDate')}
              dependencies={['startDate']}
              rules={[
                {
                  validator: async (_, value: Dayjs | null | undefined) => {
                    const start = form.getFieldValue('startDate') as Dayjs | null | undefined;
                    if (value && start && pickedDay(value) < pickedDay(start)) {
                      throw new Error(t('activity.signin.form.endBeforeStart'));
                    }
                  },
                },
              ]}
            >
              <DatePicker format="YYYY-MM-DD" allowClear />
            </Form.Item>
          </Flex>
          <Typography.Paragraph type="secondary">
            {t('activity.signin.form.dateHelp')}
          </Typography.Paragraph>
          <Typography.Text strong>{t('activity.signin.form.rewards')}</Typography.Text>
          <Form.List
            name="rewards"
            rules={[
              {
                validator: async (_, steps: StepValues[] | undefined) => {
                  if (!steps || steps.length < 1) {
                    throw new Error(t('activity.signin.form.rewardsRequired'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <Flex vertical gap={8} style={{ marginTop: 8 }}>
                <Flex gap={8} align="center">
                  <span style={{ width: 72 }} />
                  <Typography.Text type="secondary" style={{ width: 130 }}>
                    {t('activity.signin.form.rewardCredits')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ width: 130 }}>
                    {t('activity.signin.form.bonusCredits')}
                  </Typography.Text>
                </Flex>
                {fields.map((field, index) => {
                  const day = t('activity.day', { n: index + 1 });
                  return (
                    <Flex key={field.key} gap={8} align="flex-start">
                      <Typography.Text style={{ width: 72, lineHeight: '32px' }}>
                        {day}
                      </Typography.Text>
                      <Form.Item
                        name={[field.name, 'rewardCredits']}
                        rules={[creditsRule]}
                        style={{ marginBottom: 0, width: 130 }}
                      >
                        <InputNumber
                          min={0}
                          step={1}
                          precision={0}
                          style={{ width: '100%' }}
                          aria-label={`${day} ${t('activity.signin.form.rewardCredits')}`}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'bonusCredits']}
                        rules={[creditsRule]}
                        style={{ marginBottom: 0, width: 130 }}
                      >
                        <InputNumber
                          min={0}
                          step={1}
                          precision={0}
                          style={{ width: '100%' }}
                          aria-label={`${day} ${t('activity.signin.form.bonusCredits')}`}
                        />
                      </Form.Item>
                      {fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={t('activity.signin.form.removeDay', { n: index + 1 })}
                          onClick={() => remove(field.name)}
                        />
                      ) : null}
                    </Flex>
                  );
                })}
                <Form.ErrorList errors={errors} />
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => add({ rewardCredits: null, bonusCredits: 0 })}
                >
                  {t('activity.signin.form.addDay')}
                </Button>
              </Flex>
            )}
          </Form.List>
          {failure ? (
            <Alert type="error" showIcon style={{ marginTop: 16 }} title={failure} />
          ) : null}
        </Form>
      ) : null}
    </Modal>
  );
}
