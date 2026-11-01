import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal, Select, Switch, Typography } from 'antd';
import { type FailureLines, useFailureView } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { createTemplate, SMS_TYPES, type SmsTemplate, updateTemplate } from '../../services/sms';
import { failureToForm, failureWords } from '../../utils/failureToForm';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { countryCodeProblem } from './channelRules';
import { isLastOtpTemplate, keepsEnglishFallback } from './lastOtp';
import { isEnglishFallbackRefusal, templateFailureText } from './templateFailure';
import {
  buildTemplateBody,
  CODE_PLACEHOLDER,
  otpContentProblem,
  SMS_PLACEHOLDERS,
  type TemplateFormValues,
} from './templateRules';
import type { useLastOtpPrompt } from './useLastOtpPrompt';

type Values = Omit<TemplateFormValues, 'smsType'> & { smsType?: TemplateFormValues['smsType'] };

type Props = {
  /** The template being edited; none means a new template. */
  template: SmsTemplate | null;
  /** Every template, to find a code that is taken and to know whether this is the last OTP one; null when they could not be read. */
  all: SmsTemplate[] | null;
  ask: ReturnType<typeof useLastOtpPrompt>;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'templateCode',
  'name',
  'smsType',
  'locale',
  'country',
  'content',
  'providerTemplateId',
  'enabled',
] as const;

const asCoverage = (t: Partial<SmsTemplate>) => ({
  id: plainText(t.id),
  enabled: t.enabled === true,
  smsType: plainText(t.smsType),
  locale: t.locale,
  country: t.country,
});

/**
 * New or edit template. An OTP template must hold `{code}` exactly as written, and the form says so
 * as the content is typed. The code cannot be changed after it was written; the switch has its own
 * request. Changing the type of the last enabled OTP template asks first. Mounted only while it is open.
 */
export function TemplateModal({ template, all, ask, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { view: failure, show, clear } = useFailureView<FailureLines>();
  const editing = template !== null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    let guarded = false;
    if (template && values.smsType !== 'OTP') {
      const others = all ?? [template];
      if (isLastOtpTemplate(asCoverage(template), others.map(asCoverage))) {
        if (!(await ask('change', 'template'))) return;
        guarded = true;
      }
    }
    // The narrower rule: the last enabled English OTP template with no country must stay that way.
    if (template && !guarded) {
      const others = all ?? [template];
      const after = {
        smsType: values.smsType ?? '',
        locale: values.locale,
        country: values.country,
      };
      if (!keepsEnglishFallback(asCoverage(template), after, others.map(asCoverage))) {
        if (!(await ask('change', 'englishTemplate'))) return;
      }
    }
    const input = values as TemplateFormValues;
    try {
      if (template)
        await updateTemplate(plainText(template.id), buildTemplateBody(input, 'update'));
      else await createTemplate(buildTemplateBody(input, 'create'));
    } catch (error) {
      failureToForm(intl, form, error, FIELDS, {}, { generalReason: true });
      // The refusal about the English template names no field: its words stand alone at the top.
      show((words) => ({
        text: templateFailureText(words, error, guarded),
        more: isEnglishFallbackRefusal(error)
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
      title={t(editing ? 'sms.templates.editTitle' : 'sms.templates.newTitle')}
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
        name="smsTemplate"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          templateCode: '',
          name: plainText(template?.name),
          smsType: template && SMS_TYPES.includes(template.smsType) ? template.smsType : undefined,
          locale: plainText(template?.locale),
          country: plainText(template?.country),
          content: plainText(template?.content),
          providerTemplateId: plainText(template?.providerTemplateId),
          enabled: false,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {editing ? (
          <Form.Item label={t('sms.templates.field.code')}>
            <Typography.Text strong style={{ overflowWrap: 'anywhere' }}>
              {plainText(template.templateCode)}
            </Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="templateCode"
            label={t('sms.templates.field.code')}
            extra={t('sms.templates.codeHelp')}
            rules={[
              required('sms.templates.codeRequired'),
              {
                validator: async (_, value: string | undefined) => {
                  const code = trimSpec(value ?? '');
                  if (code !== '' && (all ?? []).some((x) => plainText(x.templateCode) === code)) {
                    throw new Error(t('sms.templates.codeTaken'));
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
          label={t('sms.templates.field.name')}
          rules={[required('sms.templates.nameRequired')]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="smsType"
          label={t('sms.templates.field.type')}
          extra={t('sms.templates.typeHelp')}
          rules={[required('sms.templates.typeRequired')]}
        >
          <Select
            placeholder={t('sms.templates.typePlaceholder')}
            options={SMS_TYPES.map((type) => ({ value: type, label: t(`sms.type.${type}`) }))}
          />
        </Form.Item>
        <Form.Item
          name="locale"
          label={t('sms.templates.field.locale')}
          extra={t('sms.templates.localeHelp')}
          rules={[required('sms.templates.localeRequired')]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="country"
          label={t('sms.templates.field.country')}
          extra={t('sms.templates.countryHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const code = trimSpec(value ?? '');
                if (code !== '' && countryCodeProblem(code) !== null) {
                  throw new Error(t('sms.channels.countriesInvalid'));
                }
              },
            },
          ]}
        >
          <Input dir="ltr" maxLength={20} />
        </Form.Item>
        <Form.Item
          name="content"
          label={t('sms.templates.field.content')}
          dependencies={['smsType']}
          extra={t('sms.templates.contentHelp', {
            required: CODE_PLACEHOLDER,
            placeholders: SMS_PLACEHOLDERS.join(', '),
          })}
          rules={[
            ({ getFieldValue }) => ({
              validator: async (_, value: string | undefined) => {
                const missing =
                  otpContentProblem(value, getFieldValue('smsType')) === 'MISSING_CODE';
                if (missing)
                  throw new Error(
                    t('sms.templates.contentMissingCode', { placeholder: CODE_PLACEHOLDER }),
                  );
                if (trimSpec(value ?? '') === '')
                  throw new Error(t('sms.templates.contentRequired'));
              },
            }),
          ]}
        >
          <Input.TextArea rows={4} dir="auto" />
        </Form.Item>
        <Form.Item
          name="providerTemplateId"
          label={t('sms.templates.field.providerTemplateId')}
          extra={t('sms.templates.providerTemplateIdHelp')}
        >
          <Input dir="ltr" />
        </Form.Item>
        {editing ? null : (
          <Form.Item
            name="enabled"
            valuePropName="checked"
            label={t('sms.templates.field.enabled')}
            extra={t('sms.templates.enabledHelp')}
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
