import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal, Select, Switch } from 'antd';
import { useState } from 'react';
import type { LinkTargetValue } from '../../components/LinkTargetField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  createTemplate,
  type PushTemplate,
  RECALL_REASONS,
  updateTemplate,
} from '../../services/push';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { contentFields } from './bodies';
import { ContentFields } from './ContentFields';
import { missingFor } from './coverage';
import { failureToForm } from './formFailure';
import { codeText } from './texts';
import { useUploadSlot } from './uploadSlot';

type Values = {
  triggerReason: string;
  locale: string;
  title: string;
  body: string;
  link: LinkTargetValue;
  enabled: boolean;
};

type Props = {
  open: boolean;
  /** The template being edited; none means a new template. */
  template: PushTemplate | null;
  /** Every template there is, for the check of the pair and the warning about missing languages. */
  templates: PushTemplate[];
  /** The supported languages, or `null` when they are not known. */
  locales: string[] | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['triggerReason', 'locale', 'title', 'body', 'link', 'enabled'] as const;
const ALIASES = { linkType: 'link', linkTarget: 'link' };

/**
 * New or edit template. The reason and the language are the key of a template: chosen once and then
 * fixed. A pair that has a template cannot be made again from here (the form says to edit that one).
 * Switching on while a supported language lacks a template is warned about; the backend decides.
 */
export function TemplateModal({ open, template, templates, locales, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const picture = useUploadSlot();
  const editing = template !== null;

  const reason =
    Form.useWatch('triggerReason', form) ?? template?.triggerReason ?? RECALL_REASONS[0];
  const locale = Form.useWatch('locale', form) ?? template?.locale ?? '';
  const enabled = Form.useWatch('enabled', form) ?? template?.enabled ?? false;
  const missing = missingFor(templates, locales, reason, editing ? undefined : trimSpec(locale));

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    if (rejected && !picture.uploadId) return;
    const fields = {
      ...contentFields(values, picture.uploadId),
      enabled: values.enabled,
    };
    try {
      if (template) {
        await updateTemplate(template.id, fields);
      } else {
        await createTemplate({
          ...fields,
          triggerReason: values.triggerReason,
          locale: trimSpec(values.locale),
        });
      }
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS, ALIASES);
      if (result.uploadRejected) {
        picture.reset();
        setRejected(true);
      }
      setFailure(result.text);
      return;
    }
    message.success(t('push.templates.saved'));
    onSaved();
    onClose();
  });

  const pairExists = (reasonNow: string, localeNow: string) =>
    templates.some((x) => x.triggerReason === reasonNow && x.locale === localeNow);

  return (
    <Modal
      open={open}
      title={t(editing ? 'push.templates.editTitle' : 'push.templates.newTitle')}
      destroyOnHidden
      width={640}
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
        name="pushTemplate"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          triggerReason: template?.triggerReason ?? RECALL_REASONS[0],
          locale: template?.locale ?? '',
          title: plainText(template?.title),
          body: plainText(template?.body),
          link: {
            linkType: template?.linkType ?? 'NONE',
            linkTarget: plainText(template?.linkTarget),
          },
          enabled: template?.enabled ?? false,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="triggerReason"
          label={t('push.templates.reason')}
          extra={editing ? t('push.templates.fixed') : undefined}
        >
          <Select
            disabled={editing}
            options={RECALL_REASONS.map((r) => ({
              value: r,
              label: codeText(intl, 'push.reason', r),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="locale"
          label={t('push.templates.locale')}
          extra={editing ? undefined : t('push.templates.localeHelp')}
          dependencies={['triggerReason']}
          validateTrigger={['onChange', 'onBlur']}
          rules={
            editing
              ? []
              : [
                  {
                    validator: async (_, value: string | undefined) => {
                      const tag = trimSpec(value ?? '');
                      if (tag === '') throw new Error(t('push.templates.localeRequired'));
                      if (pairExists(form.getFieldValue('triggerReason'), tag)) {
                        throw new Error(t('push.templates.exists'));
                      }
                    },
                  },
                ]
          }
        >
          {locales !== null ? (
            <Select
              disabled={editing}
              showSearch
              options={(locales.includes(template?.locale ?? '') || !editing
                ? locales
                : [template?.locale ?? '', ...locales]
              ).map((tag) => ({ value: tag, label: tag }))}
            />
          ) : (
            <Input disabled={editing} dir="auto" />
          )}
        </Form.Item>
        <ContentFields slot={picture} currentImageUrl={template?.imageUrl} rejected={rejected} />
        <Form.Item name="enabled" label={t('push.templates.enabled')} valuePropName="checked">
          <Switch />
        </Form.Item>
        {enabled && missing.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={t('push.templates.missingWarning', {
              reason: codeText(intl, 'push.reason', reason),
              locales: missing.join(', '),
            })}
          />
        ) : null}
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}
