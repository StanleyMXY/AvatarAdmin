import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  createChannel,
  SMS_TYPES,
  type SmsChannel,
  type SmsProvider,
  updateChannel,
} from '../../services/sms';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import {
  apiUrlProblem,
  buildChannelBody,
  type ChannelFormValues,
  countryCodeProblem,
  normalizeCountries,
} from './channelRules';
import { failureToForm } from './formFailure';
import { type Coverage, keepsCoverage } from './lastOtp';
import { guardedFailureText, type useLastOtpPrompt } from './useLastOtpPrompt';

type Values = Omit<ChannelFormValues, 'priority' | 'smsType'> & {
  smsType?: ChannelFormValues['smsType'];
  priority: number | null;
};

type Props = {
  /** The channel being edited; none means a new channel. */
  channel: SmsChannel | null;
  providers: SmsProvider[];
  /** Every channel, to find a code that is taken and to know what the others serve; null when they could not be read. */
  all: SmsChannel[] | null;
  ask: ReturnType<typeof useLastOtpPrompt>;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'channelCode',
  'name',
  'providerCode',
  'apiUrl',
  'credentials',
  'extConfig',
  'countries',
  'smsType',
  'priority',
  'enabled',
] as const;
const DEFAULT_PRIORITY = 100;
const CODE_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

/** The channel as the question about the last OTP channel reads it. */
export const asCoverage = (c: Partial<SmsChannel>): Coverage => ({
  id: plainText(c.id),
  enabled: c.enabled === true,
  smsType: plainText(c.smsType),
  countries: c.countries,
});

/** The text of the extension box for a channel: the JSON that is saved, written out; empty when there is none. */
function extConfigText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  let shown = value;
  if (typeof value === 'string') {
    try {
      shown = JSON.parse(value);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(shown, null, 2) ?? '';
  } catch {
    return '';
  }
}

/**
 * New or edit channel. The credentials box is write-only: it is always empty when the dialog opens,
 * whatever the backend sent, and its text goes into the request only when something was typed (an
 * empty box leaves the key out, which tells the backend to keep what it holds). The code cannot be
 * changed after it was written, and the switch has its own request. Mounted only while it is open, so
 * that nothing typed in one dialog is there in the next.
 */
export function ChannelModal({ channel, providers, all, ask, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const editing = channel !== null;
  const providerCode = Form.useWatch('providerCode', form);
  const hosts = providers.find((p) => p.code === providerCode)?.allowedHosts ?? [];

  const providerOptions = providers.map((p) => ({ value: p.code, label: p.code }));
  const current = channel ? plainText(channel.providerCode) : '';
  if (current !== '' && !providerOptions.some((o) => o.value === current)) {
    providerOptions.push({ value: current, label: current });
  }

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    let guarded = false;
    if (channel) {
      // Without the list of every channel the others are taken as not there: the question is asked.
      const others = all ?? [channel];
      const after = {
        smsType: plainText(values.smsType),
        countries: normalizeCountries(values.countries),
      };
      if (!keepsCoverage(asCoverage(channel), after, others.map(asCoverage))) {
        if (!(await ask('change', 'channel'))) return;
        guarded = true;
      }
    }
    const input = {
      ...values,
      smsType: values.smsType,
      priority: values.priority,
    } as ChannelFormValues;
    try {
      if (channel) await updateChannel(plainText(channel.id), buildChannelBody(input, 'update'));
      else await createChannel(buildChannelBody(input, 'create'));
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      setFailure({ text: guardedFailureText(intl, error, guarded), more: result.unplaced });
      return;
    }
    message.success(t('sms.common.saved'));
    onSaved();
    onClose();
  });

  const required = (id: string) => ({
    validator: async (_: unknown, value: unknown) => {
      if (
        typeof value === 'string' ? trimSpec(value) === '' : value === undefined || value === null
      ) {
        throw new Error(t(id));
      }
    },
  });

  return (
    <Modal
      open
      title={t(editing ? 'sms.channels.editTitle' : 'sms.channels.newTitle')}
      width={640}
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
        name="smsChannel"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          channelCode: '',
          name: plainText(channel?.name),
          providerCode: channel ? plainText(channel.providerCode) : undefined,
          apiUrl: plainText(channel?.apiUrl),
          credentials: '',
          extConfig: channel ? extConfigText(channel.extConfig) : '',
          countries: channel ? normalizeCountries(channel.countries) : [],
          smsType: channel && SMS_TYPES.includes(channel.smsType) ? channel.smsType : undefined,
          priority:
            channel === null
              ? DEFAULT_PRIORITY
              : typeof channel.priority === 'number'
                ? channel.priority
                : null,
          enabled: false,
        }}
        onFinish={(values) => run(values)}
      >
        {editing ? (
          <Form.Item label={t('sms.channels.field.code')}>
            <Typography.Text strong style={{ overflowWrap: 'anywhere' }}>
              {plainText(channel.channelCode)}
            </Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="channelCode"
            label={t('sms.channels.field.code')}
            extra={t('sms.channels.codeHelp')}
            rules={[
              required('sms.channels.codeRequired'),
              {
                validator: async (_, value: string | undefined) => {
                  const code = trimSpec(value ?? '');
                  if (code === '') return;
                  if (!CODE_FORMAT.test(code)) throw new Error(t('sms.channels.codeFormat'));
                  if ((all ?? []).some((c) => plainText(c.channelCode) === code)) {
                    throw new Error(t('sms.channels.codeTaken'));
                  }
                },
              },
            ]}
          >
            <Input dir="ltr" />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label={t('sms.channels.field.name')}
          rules={[required('sms.channels.nameRequired')]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="providerCode"
          label={t('sms.channels.field.provider')}
          rules={[required('sms.channels.providerRequired')]}
        >
          <Select options={providerOptions} placeholder={t('sms.channels.providerPlaceholder')} />
        </Form.Item>
        <Form.Item
          name="apiUrl"
          label={t('sms.channels.field.apiUrl')}
          dependencies={['providerCode']}
          extra={
            hosts.length > 0 ? t('sms.channels.hostsHelp', { hosts: hosts.join(', ') }) : undefined
          }
          rules={[
            required('sms.channels.apiUrlRequired'),
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') return;
                const problem = apiUrlProblem(value ?? '', hosts);
                if (problem === 'HOST_NOT_ALLOWED') {
                  throw new Error(
                    t('sms.channels.apiUrl.HOST_NOT_ALLOWED', { hosts: hosts.join(', ') }),
                  );
                }
                if (problem) throw new Error(t(`sms.channels.apiUrl.${problem}`));
              },
            },
          ]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="credentials"
          label={t('sms.channels.field.credentials')}
          extra={
            <>
              {t(
                !editing
                  ? 'sms.channels.credentialsNew'
                  : channel.hasCredentials === true
                    ? 'sms.channels.credentialsSet'
                    : 'sms.channels.credentialsNotSet',
              )}{' '}
              {t('sms.channels.credentialsWriteOnly')}
            </>
          }
        >
          <Input.Password
            autoComplete="new-password"
            visibilityToggle={false}
            dir="ltr"
            placeholder={editing ? t('sms.channels.credentialsPlaceholder') : undefined}
          />
        </Form.Item>
        <Form.Item
          name="extConfig"
          label={t('sms.channels.field.extConfig')}
          extra={t('sms.channels.extConfigHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const text = trimSpec(value ?? '');
                if (text === '') return;
                let parsed: unknown;
                try {
                  parsed = JSON.parse(text);
                } catch {
                  throw new Error(t('sms.channels.extNotJson'));
                }
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                  throw new Error(t('sms.channels.extNotObject'));
                }
              },
            },
          ]}
        >
          <Input.TextArea
            rows={6}
            spellCheck={false}
            dir="ltr"
            style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}
          />
        </Form.Item>
        <Form.Item
          name="countries"
          label={t('sms.channels.field.countries')}
          extra={t('sms.channels.countriesHelp')}
          rules={[
            {
              validator: async (_, value: string[] | undefined) => {
                if (
                  (value ?? []).some((code) => countryCodeProblem(trimSpec(String(code))) !== null)
                ) {
                  throw new Error(t('sms.channels.countriesInvalid'));
                }
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[',', ' ', ';']} open={false} suffixIcon={null} />
        </Form.Item>
        <Form.Item
          name="smsType"
          label={t('sms.channels.field.type')}
          rules={[required('sms.channels.typeRequired')]}
        >
          <Select
            placeholder={t('sms.channels.typePlaceholder')}
            options={SMS_TYPES.map((type) => ({ value: type, label: t(`sms.type.${type}`) }))}
          />
        </Form.Item>
        <Form.Item
          name="priority"
          label={t('sms.channels.field.priority')}
          extra={t('sms.channels.priorityHelp')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                  throw new Error(t('sms.channels.priorityRequired'));
                }
              },
            },
          ]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        {editing ? null : (
          <Form.Item
            name="enabled"
            valuePropName="checked"
            label={t('sms.channels.field.enabled')}
            extra={t('sms.channels.enabledHelp')}
          >
            <Switch />
          </Form.Item>
        )}
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
