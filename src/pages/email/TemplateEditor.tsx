import { useIntl } from '@umijs/max';
import { Alert, App, Divider, Flex, Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type EmailTemplate, resetEmailTemplate, saveEmailTemplate } from '../../services/email';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { failureToForm } from '../../utils/failureToForm';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { listOfText, missingPlaceholders } from './placeholders';

export const SUBJECT_MAX = 200;

type Values = { subject: string; body: string };

type Props = {
  template: EmailTemplate;
  onClose: () => void;
  /** The list is read again. */
  onChanged: () => void;
};

/**
 * The editor of one template (EMAIL:TEMPLATE). The placeholders that may be used, and the ones that
 * must be in the body, are those the backend gave, with their braces; the body is checked for the
 * required ones as it is typed and again on saving, exactly as the backend does it (the string as
 * written, case included). The default text is shown, and restoring it asks inline. Mounted only while it is open.
 */
export function TemplateEditor({ template, onClose, onChanged }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const code = plainText(template.templateCode);
  const placeholders = listOfText(template.placeholders);
  const required = listOfText(template.requiredPlaceholders);
  const subjectNow = Form.useWatch('subject', form) ?? plainText(template.subject);
  const modified = template.modified === true;
  // What a placeholder stands for, where the language file knows the name (the name between the braces). The check of the body does not use this.
  const explanationOf = (placeholder: string): string | null => {
    const name = placeholder.replace(/^\{|\}$/g, '');
    return intl.messages[`email.placeholder.${name}`] ? t(`email.placeholder.${name}`) : null;
  };

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    try {
      await saveEmailTemplate(code, {
        subject: trimSpec(values.subject),
        body: trimSpec(values.body),
      });
    } catch (error) {
      const result = failureToForm(
        intl,
        form,
        error,
        ['subject', 'body'],
        {},
        { generalReason: true },
      );
      setFailure({ text: result.text, more: result.unplaced });
      return;
    }
    message.success(t('email.templates.saved'));
    onChanged();
    onClose();
  });

  const restore = useSingleFlight(async () => {
    try {
      await resetEmailTemplate(code);
    } catch (error) {
      message.error(describeFailure(intl, error).text);
      throw error;
    }
    message.success(t('email.templates.restored'));
    onChanged();
    onClose();
  });

  // A save and a restore are both writes of the same template: while one is on its way the dialog
  // can neither start the other nor be closed.
  const busy = pending || restore.pending;

  return (
    <Modal
      open
      title={t('email.templates.editTitle')}
      width={760}
      mask={{ closable: false }}
      onCancel={busy ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="emailTemplate"
        layout="vertical"
        requiredMark={false}
        initialValues={{ subject: plainText(template.subject), body: plainText(template.body) }}
        onFinish={(values) => (restore.pending ? undefined : run(values))}
      >
        <RevalidateOnLocaleChange />
        <Form.Item label={t('email.templates.field.code')}>
          <Typography.Text strong style={{ overflowWrap: 'anywhere' }}>
            {code}
          </Typography.Text>
        </Form.Item>
        <Form.Item
          name="subject"
          label={t('email.templates.field.subject')}
          extra={t('email.templates.subjectCount', {
            count: countCodePoints(trimSpec(subjectNow)),
            max: SUBJECT_MAX,
          })}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const length = countCodePoints(trimSpec(value ?? ''));
                if (length < 1 || length > SUBJECT_MAX) {
                  throw new Error(t('email.templates.subjectInvalid'));
                }
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <div data-kind="placeholders" style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">{t('email.templates.placeholders')}</Typography.Text>
          <ul style={{ listStyle: 'none', margin: '4px 0 0', paddingInlineStart: 0 }}>
            {placeholders.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a backend that lists a placeholder twice must not break the keys
              <li key={`${p}-${i}`}>
                <Typography.Text code>{p}</Typography.Text>
                {explanationOf(p) ? (
                  <Typography.Text type="secondary" data-kind="explanation">
                    {' '}
                    {explanationOf(p)}
                  </Typography.Text>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div data-kind="required" style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary">{t('email.templates.required')} </Typography.Text>
          {required.length === 0 ? (
            <Typography.Text type="secondary">{t('email.templates.requiredNone')}</Typography.Text>
          ) : (
            <Flex wrap gap={4} style={{ display: 'inline-flex' }}>
              {required.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                <Typography.Text code key={`${p}-${i}`}>
                  {p}
                </Typography.Text>
              ))}
            </Flex>
          )}
        </div>
        <Form.Item
          name="body"
          label={t('email.templates.field.body')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const body = value ?? '';
                if (trimSpec(body) === '') throw new Error(t('email.templates.bodyRequired'));
                const missing = missingPlaceholders(body, required);
                if (missing.length > 0) {
                  throw new Error(t('email.templates.missing', { list: missing.join(', ') }));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={10} dir="auto" />
        </Form.Item>
        {failure ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
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
      <Divider style={{ margin: '12px 0' }} />
      <div data-kind="default">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('email.templates.defaultTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('email.templates.field.subject')}</Typography.Text>
        <Typography.Paragraph
          dir="auto"
          style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        >
          {plainText(template.defaultSubject)}
        </Typography.Paragraph>
        <Typography.Text type="secondary">{t('email.templates.field.body')}</Typography.Text>
        <Typography.Paragraph
          dir="auto"
          style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        >
          {plainText(template.defaultBody)}
        </Typography.Paragraph>
      </div>
      <Flex align="center" gap={12} wrap>
        <DangerConfirmButton
          confirmText={t('email.templates.restoreAsk')}
          disabled={!modified || busy}
          onConfirm={async () => {
            await restore.run().catch(() => undefined);
          }}
        >
          {t('email.templates.restore')}
        </DangerConfirmButton>
        {modified ? null : (
          <Typography.Text type="secondary">{t('email.templates.notChanged')}</Typography.Text>
        )}
      </Flex>
    </Modal>
  );
}
