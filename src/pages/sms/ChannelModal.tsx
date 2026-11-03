import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd';
import { type FailureLines, useFailureView } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import {
  createChannel,
  SMS_TYPES,
  type SmsChannel,
  type SmsProvider,
  updateChannel,
} from '../../services/sms';
import { failureToForm, failureWords } from '../../utils/failureToForm';
import { setFieldReasons } from '../../utils/fieldReasons';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { CredentialFields } from './CredentialFields';
import {
  apiUrlProblem,
  buildChannelBody,
  type ChannelFormValues,
  type CredentialValues,
  countryCodeProblem,
  credentialsProblem,
  normalizeCountries,
} from './channelRules';
import { type Coverage, keepsCoverage } from './lastOtp';
import {
  guardedFailureText,
  isLastChannelRefusal,
  type useLastOtpPrompt,
} from './useLastOtpPrompt';

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

/** The reasons that a refused save names for the `credentials` (a name missing, or one the provider does not use). */
function credentialsRefusals(error: unknown): ('EMPTY_NOT_ALLOWED' | 'OUT_OF_RANGE')[] {
  if (!(error instanceof ApiError)) return [];
  const found = error.details
    .filter((d) => d.ref === 'credentials')
    .map((d) => d.reason)
    .filter(
      (reason): reason is 'EMPTY_NOT_ALLOWED' | 'OUT_OF_RANGE' =>
        reason === 'EMPTY_NOT_ALLOWED' || reason === 'OUT_OF_RANGE',
    );
  // The last one is the one shown, as it is for any field.
  return found.slice(-1);
}

/** The channel as the question about the last OTP channel reads it. */
export const asCoverage = (c: Partial<SmsChannel>): Coverage => ({
  id: plainText(c.id),
  enabled: c.enabled === true,
  smsType: plainText(c.smsType),
  countries: c.countries,
});

/** The text of the extension box for a channel: the JSON that is saved, written out; empty when there is none (or it is {}). */
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
  // The backend always answers an object; {} is "no extension", so the box is empty for it.
  if (typeof shown === 'object' && shown !== null && Object.keys(shown).length === 0) return '';
  try {
    return JSON.stringify(shown, null, 2) ?? '';
  } catch {
    return '';
  }
}

/**
 * New or edit channel. The credentials are write-only: one box for each name that the chosen
 * provider declares (`credentialNames` of `GET /sms/meta`), the names are fixed, and there is nothing
 * in the boxes when the dialog opens, whatever the backend sent. The request carries them (a map of
 * those names to text values) only when every box was filled; all blank leaves the key out, which
 * tells the backend to keep what it holds; some filled and some blank is refused here, because the
 * backend wants exactly the declared names. Changing the provider of a channel to another one that
 * needs credentials asks for all of them (what is saved belongs to the old provider). The code cannot
 * be changed after it was written, and the switch has its own request. Mounted only while it is open,
 * so that nothing typed in one dialog is there in the next.
 */
export function ChannelModal({ channel, providers, all, ask, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { view: failure, show, clear } = useFailureView<FailureLines>();
  const editing = channel !== null;
  const providerCode = Form.useWatch('providerCode', form);
  const provider = providers.find((p) => p.code === providerCode);
  const hosts = provider?.allowedHosts ?? [];
  // The names this provider declares; none is known for one that the backend does not list.
  const credentialNames = provider?.credentialNames ?? [];
  // What is saved belongs to the provider the channel has now: another one needs its own, whole.
  const switched =
    editing && provider !== undefined && providerCode !== plainText(channel.providerCode);
  const mustFill = switched && credentialNames.length > 0;

  const providerOptions = providers.map((p) => ({ value: p.code, label: p.code }));
  const current = channel ? plainText(channel.providerCode) : '';
  if (current !== '' && !providerOptions.some((o) => o.value === current)) {
    providerOptions.push({ value: current, label: current });
  }

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    if (channel) {
      // Without the list of every channel the others are taken as not there: the question is asked.
      const others = all ?? [channel];
      const after = {
        smsType: plainText(values.smsType),
        countries: normalizeCountries(values.countries),
      };
      if (!keepsCoverage(asCoverage(channel), after, others.map(asCoverage))) {
        if (!(await ask('change', 'channel'))) return;
      }
    }
    const input = {
      ...values,
      smsType: values.smsType,
      priority: values.priority,
    } as ChannelFormValues;
    try {
      if (channel) {
        await updateChannel(
          plainText(channel.id),
          buildChannelBody(input, 'update', credentialNames),
        );
      } else {
        await createChannel(buildChannelBody(input, 'create', credentialNames));
      }
    } catch (error) {
      failureToForm(intl, form, error, FIELDS, {}, { generalReason: true });
      // The two refusals of the credentials have a text of their own, written for this box.
      setFieldReasons(
        form,
        intl,
        credentialsRefusals(error).map((reason) => ({
          name: 'credentials',
          write: (words) =>
            words.formatMessage({ id: `sms.channels.credentialsRefused.${reason}` }),
        })),
      );
      // The refusal about the last channel names no field: its words stand alone at the top.
      show((words) => ({
        text: guardedFailureText(words, error),
        more: isLastChannelRefusal(error)
          ? []
          : failureWords(words, error, FIELDS, {}, { generalReason: true }).unplaced,
      }));
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
        autoComplete="off"
        requiredMark={false}
        initialValues={{
          channelCode: '',
          name: plainText(channel?.name),
          providerCode: channel ? plainText(channel.providerCode) : undefined,
          apiUrl: plainText(channel?.apiUrl),
          credentials: {},
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
        // What was typed for one provider is not carried to another: the boxes start empty again.
        onValuesChange={(changed) => {
          if ('providerCode' in changed) form.resetFields(['credentials']);
        }}
      >
        <RevalidateOnLocaleChange />
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
          dependencies={['providerCode']}
          extra={
            <>
              {t(
                !editing
                  ? 'sms.channels.credentialsNew'
                  : channel.hasCredentials === true
                    ? 'sms.channels.credentialsSet'
                    : 'sms.channels.credentialsNotSet',
              )}{' '}
              {t('sms.channels.credentialsWriteOnly')}{' '}
              {!providerCode
                ? t('sms.channels.credentialsChooseProvider')
                : provider === undefined
                  ? t('sms.channels.credentialsUnknownProvider')
                  : credentialNames.length === 0
                    ? t('sms.channels.credentialsNone')
                    : switched
                      ? t('sms.channels.credentialsSwitched')
                      : null}
            </>
          }
          rules={[
            {
              validator: async (_, value: CredentialValues | undefined) => {
                const problem = credentialsProblem(value, credentialNames, mustFill);
                if (problem) {
                  throw new Error(
                    t(
                      problem.kind === 'REQUIRED'
                        ? 'sms.channels.credentialsRequired'
                        : 'sms.channels.credentialsIncomplete',
                      { names: problem.missing.map(plainText).join(', ') },
                    ),
                  );
                }
              },
            },
          ]}
        >
          {/* Keyed by the provider: the boxes of another provider start empty, nothing typed for one is carried to the next. */}
          <CredentialFields key={providerCode ?? ''} names={credentialNames} />
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
                  throw new Error(t('pages.json.invalid'));
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
                  {[...new Set(failure.more)].map((line) => (
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
