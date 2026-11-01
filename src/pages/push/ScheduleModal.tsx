import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Checkbox,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Radio,
  Select,
  Switch,
  TimePicker,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import type { LinkTargetValue } from '../../components/LinkTargetField';
import { useFailure } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { useUploadSlot } from '../../hooks/useUploadSlot';
import {
  type Audience,
  createSchedule,
  type PushPlatform,
  type PushSchedule,
  REPEATS,
  type Repeat,
  updateSchedule,
} from '../../services/push';
import { failureToForm } from '../../utils/failureToForm';
import { pickedDay } from '../../utils/utcDay';
import { AudienceFields } from './AudienceFields';
import { scheduleFields, scheduleToValues, timeZoneNames } from './bodies';
import { ContentFields } from './ContentFields';

type Values = {
  repeat: Repeat;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  time: Dayjs | null;
  timezone: string;
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  enabled: boolean;
  audience: Audience;
  accountIdsText: string;
  platforms: PushPlatform[];
  locales: string[];
  title: string;
  body: string;
  link: LinkTargetValue;
};

type Props = {
  open: boolean;
  /** The schedule being edited; none means a new one. */
  schedule: PushSchedule | null;
  locales: string[] | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'repeat',
  'daysOfWeek',
  'dayOfMonth',
  'time',
  'timezone',
  'startDate',
  'endDate',
  'enabled',
  'audience',
  'accountIdsText',
  'platforms',
  'locales',
  'title',
  'body',
  'link',
] as const;
const ALIASES = {
  timeOfDay: 'time',
  accountIds: 'accountIdsText',
  linkType: 'link',
  linkTarget: 'link',
};
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** The clock reading `HH:mm` as a value the time picker holds (only the clock matters). */
const clockOf = (text: string): Dayjs | null => {
  const picked = dayjs(`2000-01-01T${text}`);
  return /^\d{2}:\d{2}$/.test(text) && picked.isValid() ? picked : null;
};
const dayOf = (text: string | null): Dayjs | null => {
  const picked = text ? dayjs(`${text}T00:00:00`) : null;
  return picked?.isValid() ? picked : null;
};

/**
 * New or edit periodic push: when it repeats, the clock time in a fixed time zone, the dates, who
 * gets it, and the words, link and picture of a task. The time zone is not each user's local time.
 */
export function ScheduleModal({ open, schedule, locales, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { text: failure, fail, clear } = useFailure();
  const [rejected, setRejected] = useState(false);
  const picture = useUploadSlot();
  const editing = schedule !== null;
  const repeat = Form.useWatch('repeat', form) ?? schedule?.repeat ?? 'DAILY';
  const zones = useMemo(() => timeZoneNames(schedule?.timezone), [schedule?.timezone]);

  const initial = useMemo(() => {
    if (!schedule) {
      return {
        repeat: 'DAILY' as Repeat,
        daysOfWeek: [] as number[],
        dayOfMonth: null,
        time: null,
        timezone: 'UTC',
        startDate: null,
        endDate: null,
        enabled: true,
        audience: 'ALL' as Audience,
        accountIdsText: '',
        platforms: [] as PushPlatform[],
        locales: [] as string[],
        title: '',
        body: '',
        link: { linkType: 'NONE', linkTarget: '' } as LinkTargetValue,
      };
    }
    const v = scheduleToValues(schedule);
    return {
      ...v,
      time: clockOf(v.timeOfDay),
      startDate: dayOf(v.startDate),
      endDate: dayOf(v.endDate),
    };
  }, [schedule]);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    if (rejected && !picture.uploadId) return;
    const body = scheduleFields(
      {
        ...values,
        timeOfDay: values.time ? values.time.format('HH:mm') : '',
        startDate: values.startDate ? pickedDay(values.startDate) : '',
        endDate: values.endDate ? pickedDay(values.endDate) : null,
      },
      picture.uploadId,
    );
    try {
      if (schedule) await updateSchedule(schedule.id, body);
      else await createSchedule(body);
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS, ALIASES);
      if (result.uploadRejected) {
        picture.reset();
        setRejected(true);
      }
      fail(error);
      return;
    }
    message.success(t('push.schedules.saved'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t(editing ? 'push.schedules.editTitle' : 'push.schedules.newTitle')}
      destroyOnHidden
      width={720}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        picture.reset();
        clear();
        setRejected(false);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || picture.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="pushSchedule"
        layout="vertical"
        requiredMark={false}
        initialValues={initial}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item name="repeat" label={t('push.schedules.repeat')}>
          <Radio.Group options={REPEATS.map((r) => ({ value: r, label: t(`push.repeat.${r}`) }))} />
        </Form.Item>
        {repeat === 'WEEKLY' ? (
          <Form.Item
            name="daysOfWeek"
            label={t('push.schedules.daysOfWeek')}
            rules={[
              {
                validator: async (_, value: number[] | undefined) => {
                  if (!value || value.length === 0)
                    throw new Error(t('push.schedules.daysRequired'));
                },
              },
            ]}
          >
            <Checkbox.Group
              options={WEEKDAYS.map((d) => ({ value: d, label: t(`push.weekday.${d}`) }))}
            />
          </Form.Item>
        ) : null}
        {repeat === 'MONTHLY' ? (
          <Form.Item
            name="dayOfMonth"
            label={t('push.schedules.dayOfMonth')}
            extra={t('push.schedules.monthEndNote')}
            rules={[
              {
                validator: async (_, value: number | null | undefined) => {
                  if (
                    typeof value !== 'number' ||
                    !Number.isInteger(value) ||
                    value < 1 ||
                    value > 31
                  ) {
                    throw new Error(t('push.schedules.dayOfMonthRange'));
                  }
                },
              },
            ]}
          >
            <InputNumber min={1} max={31} step={1} style={{ width: 120 }} />
          </Form.Item>
        ) : null}
        <Form.Item
          name="time"
          label={t('push.schedules.timeOfDay')}
          rules={[
            {
              validator: async (_, value: Dayjs | null | undefined) => {
                if (!value) throw new Error(t('push.schedules.timeRequired'));
              },
            },
          ]}
        >
          <TimePicker format="HH:mm" needConfirm={false} />
        </Form.Item>
        <Form.Item
          name="timezone"
          label={t('push.schedules.timezone')}
          extra={t('push.schedules.timezoneNote')}
          rules={[{ required: true, message: t('push.schedules.timezoneRequired') }]}
        >
          <Select showSearch options={zones.map((zone) => ({ value: zone, label: zone }))} />
        </Form.Item>
        <Form.Item
          name="startDate"
          label={t('push.schedules.startDate')}
          rules={[
            {
              validator: async (_, value: Dayjs | null | undefined) => {
                if (!value) throw new Error(t('push.schedules.startRequired'));
              },
            },
          ]}
        >
          <DatePicker format="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item
          name="endDate"
          label={t('push.schedules.endDate')}
          extra={t('push.schedules.datesHelp')}
          dependencies={['startDate']}
          rules={[
            {
              validator: async (_, value: Dayjs | null | undefined) => {
                const start = form.getFieldValue('startDate') as Dayjs | null | undefined;
                if (value && start && pickedDay(value) < pickedDay(start)) {
                  throw new Error(t('push.schedules.endBeforeStart'));
                }
              },
            },
          ]}
        >
          <DatePicker format="YYYY-MM-DD" allowClear />
        </Form.Item>
        <AudienceFields form={form} locales={locales} />
        <ContentFields slot={picture} currentImageUrl={schedule?.imageUrl} rejected={rejected} />
        <Form.Item name="enabled" label={t('push.schedules.enabled')} valuePropName="checked">
          <Switch />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
