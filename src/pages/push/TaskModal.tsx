import { useIntl } from '@umijs/max';
import { Alert, App, DatePicker, Form, Modal, Radio } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import type { LinkTargetValue } from '../../components/LinkTargetField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type Audience, createTask, type PushPlatform } from '../../services/push';
import { AudienceFields } from './AudienceFields';
import { audienceFields, contentFields, pickedInstantUtc } from './bodies';
import { ContentFields } from './ContentFields';
import { failureToForm } from './formFailure';
import { useUploadSlot } from './uploadSlot';

type Values = {
  audience: Audience;
  accountIdsText: string;
  platforms: PushPlatform[];
  locales: string[];
  title: string;
  body: string;
  link: LinkTargetValue;
  sendMode: 'now' | 'at';
  sendAt: Dayjs | null;
};

type Props = {
  open: boolean;
  locales: string[] | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'audience',
  'accountIdsText',
  'platforms',
  'locales',
  'title',
  'body',
  'link',
  'sendAt',
] as const;
const ALIASES = {
  accountIds: 'accountIdsText',
  linkType: 'link',
  linkTarget: 'link',
  scheduledAt: 'sendAt',
};

/** New manual task: the audience, the words, the link, the picture, and when to send. */
export function TaskModal({ open, locales, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const picture = useUploadSlot();
  const mode = Form.useWatch('sendMode', form) ?? 'now';

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    if (rejected && !picture.uploadId) return;
    try {
      await createTask({
        ...audienceFields(values),
        ...contentFields(values, picture.uploadId),
        ...(values.sendMode === 'at' && values.sendAt
          ? { scheduledAt: pickedInstantUtc(values.sendAt) }
          : {}),
      });
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS, ALIASES);
      if (result.uploadRejected) {
        picture.reset();
        setRejected(true);
      }
      setFailure(result.text);
      return;
    }
    message.success(t('push.tasks.created'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={t('push.tasks.newTitle')}
      destroyOnHidden
      width={680}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        picture.reset();
        setFailure(null);
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
        name="pushTask"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          audience: 'ALL',
          accountIdsText: '',
          platforms: [],
          locales: [],
          title: '',
          body: '',
          link: { linkType: 'NONE', linkTarget: '' },
          sendMode: 'now',
          sendAt: null,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <AudienceFields form={form} locales={locales} />
        <ContentFields slot={picture} rejected={rejected} />
        <Form.Item name="sendMode" label={t('push.tasks.sendTime')}>
          <Radio.Group
            options={[
              { value: 'now', label: t('push.tasks.sendNow') },
              { value: 'at', label: t('push.tasks.sendAt') },
            ]}
          />
        </Form.Item>
        {mode === 'at' ? (
          <Form.Item
            name="sendAt"
            label={t('push.tasks.sendAtLabel')}
            extra={t('push.tasks.sendAtHelp')}
            rules={[
              {
                validator: async (_, value: Dayjs | null | undefined) => {
                  if (!value) throw new Error(t('push.tasks.sendAtRequired'));
                  if (Date.parse(pickedInstantUtc(value)) < Date.now()) {
                    throw new Error(t('push.tasks.sendAtPast'));
                  }
                },
              },
            ]}
          >
            <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" needConfirm />
          </Form.Item>
        ) : null}
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
