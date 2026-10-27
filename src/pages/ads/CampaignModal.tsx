import { useIntl } from '@umijs/max';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type AdCampaign, createCampaign, updateCampaign } from '../../services/ads';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';

type Values = {
  name: string;
  description: string;
  priority: number | null;
  startAt: Dayjs | null;
  endAt: Dayjs | null;
};

type Props = {
  open: boolean;
  /** The campaign being edited; none means a new campaign. */
  campaign: AdCampaign | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['name', 'description', 'priority', 'startAt', 'endAt'] as const;
const DEFAULT_PRIORITY = 100;

const asDayjs = (value: unknown): Dayjs | null => {
  if (typeof value !== 'string' || value === '') return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

/**
 * What goes to the backend for a time field: the instant of the clock the picker shows (in the
 * time zone of the browser). A time that was not changed is sent as the backend gave it: the
 * picker has no seconds, and a save must not move what the person did not touch.
 */
function instantOf(picked: Dayjs | null, original: unknown): string | null {
  if (picked === null) return null;
  const before = asDayjs(original);
  if (before && typeof original === 'string' && before.isSame(picked, 'minute')) return original;
  return picked.toISOString();
}

/**
 * New or edit campaign. A campaign that has ended is not edited (the page does not offer it). The
 * update is a Merge Patch, so every field is sent: a cleared description or time goes as `null`.
 */
export function CampaignModal({ open, campaign, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const editing = campaign !== null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const body = {
      name: trimSpec(values.name),
      description: trimSpec(values.description ?? '') || null,
      priority: values.priority ?? DEFAULT_PRIORITY,
      startAt: instantOf(values.startAt, campaign?.startAt),
      endAt: instantOf(values.endAt, campaign?.endAt),
    };
    try {
      if (campaign) await updateCampaign(campaign.id, body);
      else await createCampaign(body);
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      setFailure({ text: result.text, more: result.unplaced });
      return;
    }
    message.success(t('ads.common.saved'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t(editing ? 'ads.campaigns.editTitle' : 'ads.campaigns.newTitle')}
      destroyOnHidden
      width={560}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="adCampaign"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          name: plainText(campaign?.name),
          description: plainText(campaign?.description),
          priority: typeof campaign?.priority === 'number' ? campaign.priority : DEFAULT_PRIORITY,
          startAt: asDayjs(campaign?.startAt),
          endAt: asDayjs(campaign?.endAt),
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="name"
          label={t('ads.campaigns.field.name')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') throw new Error(t('ads.campaigns.nameRequired'));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="description" label={t('ads.campaigns.field.description')}>
          <Input.TextArea rows={3} dir="auto" />
        </Form.Item>
        <Form.Item
          name="priority"
          label={t('ads.campaigns.field.priority')}
          extra={t('ads.campaigns.priorityHelp')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                  throw new Error(t('ads.common.wholeNumber'));
                }
              },
            },
          ]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="startAt" label={t('ads.campaigns.field.startAt')}>
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            allowClear
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="endAt"
          label={t('ads.campaigns.field.endAt')}
          dependencies={['startAt']}
          rules={[
            ({ getFieldValue }) => ({
              validator: async (_, value: Dayjs | null | undefined) => {
                const start = getFieldValue('startAt') as Dayjs | null | undefined;
                if (value && start && value.isBefore(start, 'minute')) {
                  throw new Error(t('ads.campaigns.endBeforeStart'));
                }
              },
            }),
          ]}
        >
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            allowClear
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          {t('ads.campaigns.timeHelp', { zone })}
        </Typography.Paragraph>
        {failure ? (
          <Alert
            type="error"
            showIcon
            title={failure.text}
            description={
              failure.more.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {failure.more.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        ) : null}
      </Form>
    </Modal>
  );
}
