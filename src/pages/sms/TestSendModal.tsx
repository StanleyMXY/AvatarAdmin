import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal, Typography } from 'antd';
import { useCallback, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { getSmsMeta, type SmsChannel, sendTestSms } from '../../services/sms';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { countText } from './texts';
import { useLatestRead } from './useLatestRead';

type Props = { channel: SmsChannel; onClose: () => void };

/**
 * Test send (SMS:CHANNEL:CONFIG): a number to send the fixed test text to, and how many test sends
 * the signed-in administrator has left today. The count is read when the dialog opens, so it is
 * today's, and again after a refusal for the day's limit. The number typed here is sent and is not
 * kept anywhere else on the page. Mounted only while it is open.
 */
export function TestSendModal({ channel, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<{ mobile: string }>();
  const [failure, setFailure] = useState<string | null>(null);
  const read = useCallback(() => getSmsMeta(), []);
  const meta = useLatestRead(read);
  const remaining = meta.data ? meta.data.testRemainingToday : undefined;

  const { run, pending } = useSingleFlight(async (values: { mobile: string }) => {
    setFailure(null);
    try {
      await sendTestSms(plainText(channel.id), trimSpec(values.mobile));
    } catch (error) {
      const { error: failed, text } = describeFailure(intl, error);
      setFailure(text);
      if (failed.code === 'RATE_LIMITED') meta.reload();
      return;
    }
    message.success(t('sms.channels.testSent'));
    onClose();
  });

  const none = remaining === 0;

  return (
    <Modal
      open
      title={t('sms.channels.testTitle')}
      width={480}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('sms.channels.testSend')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || none }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Typography.Paragraph strong style={{ overflowWrap: 'anywhere' }}>
        {plainText(channel.channelCode)}
      </Typography.Paragraph>
      {meta.data ? (
        <Typography.Paragraph>
          {t('sms.channels.testRemaining', { count: countText(intl.locale, remaining) })}
        </Typography.Paragraph>
      ) : null}
      {none ? (
        <Alert
          type="warning"
          showIcon
          title={t('sms.channels.testNone')}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {meta.failure !== null ? (
        <Alert
          type="warning"
          showIcon
          title={t('sms.channels.testMetaFailed')}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Form
        form={form}
        name="smsTestSend"
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => run(values)}
      >
        <Form.Item
          name="mobile"
          label={t('sms.channels.testNumber')}
          extra={t('sms.channels.testHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '')
                  throw new Error(t('sms.channels.testNumberRequired'));
              },
            },
          ]}
        >
          <Input dir="ltr" inputMode="tel" autoComplete="off" />
        </Form.Item>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
