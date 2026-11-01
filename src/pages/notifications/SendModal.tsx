import { Link, useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Checkbox,
  Flex,
  Form,
  Input,
  Modal,
  Tabs,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import {
  LinkTargetField,
  type LinkTargetValue,
  linkTargetRule,
} from '../../components/LinkTargetField';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { isOutcomeUnknown } from '../../request/errors';
import { sendNotifications } from '../../services/notifications';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import {
  addLanguage,
  buildSendBody,
  type Entry,
  entryProblems,
  lengthOf,
  MAX_BODY,
  MAX_TITLE,
} from './compose';
import { parseRecipients, recipientsProblem, visibleId } from './recipients';
import { reasonText } from './texts';

type Values = { recipients: string; link: LinkTargetValue; push: boolean };

/** The send that was refused or failed, and the ids it carried. */
type Refusal = { error: unknown; ids: string[]; edited: string[] };

/** What a refused or failed send shows under the form. */
type Failure = {
  text: string;
  /** True only when the backend answered 400: it checks everything first and writes nothing then. */
  notSent: boolean;
  /** Answer never came: nobody knows whether the batch was written. */
  maybeSent: boolean;
  lines: string[];
  /** Account details come first, with their own heading. */
  accountLines: string[];
};

const FIELD_REFS = ['accountIds', 'titleI18n', 'bodyI18n', 'linkType', 'linkTarget'];

/** Where a detail `titleI18n.th` belongs: the field and the language. */
function languageRef(ref: string): { field: 'title' | 'body'; locale: string } | null {
  if (ref.startsWith('titleI18n.'))
    return { field: 'title', locale: ref.slice('titleI18n.'.length) };
  if (ref.startsWith('bodyI18n.')) return { field: 'body', locale: ref.slice('bodyI18n.'.length) };
  return null;
}

/**
 * The dialog that sends a message to named accounts: one account ID per line, the title and the
 * body per language (English required, 100 and 500 code points), a link, and whether to push too.
 * One bad recipient refuses the whole batch and the dialog lists each of them. The page mounts it
 * only while it is open, so it never shows what was typed the time before.
 */
export function SendModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const meta = useAdminMeta();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [entries, setEntries] = useState<Entry[]>([{ locale: 'en', title: '', body: '' }]);
  const [active, setActive] = useState('en');
  const [attempted, setAttempted] = useState(false);
  // The last send the backend refused, kept as the failure itself (not as words, which would stay in
  // the language they were made in); `edited` are the texts typed in since (`title:th`): their marks go.
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const refused = refusal === null ? null : refusalView(intl, t, refusal);
  const failure = refused === null ? null : refused.failure;
  const serverErrors: Record<string, string> = Object.fromEntries(
    Object.entries(refused?.textErrors ?? {}).filter(([key]) => !refusal?.edited.includes(key)),
  );
  const [newLanguage, setNewLanguage] = useState('');
  const [languageProblem, setLanguageProblem] = useState<'DUPLICATE' | 'INVALID' | null>(null);

  const recipientsText: string = Form.useWatch('recipients', form) ?? '';
  const parsed = useMemo(() => parseRecipients(recipientsText), [recipientsText]);

  const problemsOfEntry = (entry: Entry) => entryProblems(entry);
  // An over-long text is shown at once; an empty one only once the person has pressed Send.
  const visibleProblems = (entry: Entry) => {
    const problems = problemsOfEntry(entry);
    return {
      title: problems.title === 'TOO_LONG' || attempted ? problems.title : undefined,
      body: problems.body === 'TOO_LONG' || attempted ? problems.body : undefined,
    };
  };

  const problemText = (field: 'title' | 'body', problem: string | undefined, entry: Entry) => {
    if (!problem) return null;
    if (problem === 'TOO_LONG') {
      return t(
        field === 'title' ? 'notifications.send.titleTooLong' : 'notifications.send.bodyTooLong',
        {
          max: field === 'title' ? MAX_TITLE : MAX_BODY,
          count: lengthOf(field === 'title' ? entry.title : entry.body),
        },
      );
    }
    return reasonText(intl, problem);
  };

  const update = (locale: string, patch: Partial<Entry>) => {
    setEntries((all) =>
      all.map((entry) => (entry.locale === locale ? { ...entry, ...patch } : entry)),
    );
    const field = 'title' in patch ? 'title' : 'body';
    setRefusal((current) =>
      current === null ? null : { ...current, edited: [...current.edited, `${field}:${locale}`] },
    );
  };

  const hasError = (entry: Entry) => {
    const visible = visibleProblems(entry);
    return (
      visible.title !== undefined ||
      visible.body !== undefined ||
      `title:${entry.locale}` in serverErrors ||
      `body:${entry.locale}` in serverErrors
    );
  };

  const suggestions = (Array.isArray(meta.supportedLocales) ? meta.supportedLocales : [])
    .filter((tag): tag is string => typeof tag === 'string')
    .filter((tag) => !entries.some((entry) => entry.locale.toLowerCase() === tag.toLowerCase()))
    .map((tag) => ({ value: tag }));

  const addTab = () => {
    const result = addLanguage(entries, newLanguage);
    if (!result.ok) {
      setLanguageProblem(result.problem === 'DUPLICATE' ? 'DUPLICATE' : 'INVALID');
      return;
    }
    setLanguageProblem(null);
    setEntries(result.entries);
    setActive(result.entries[result.entries.length - 1].locale);
    setNewLanguage('');
  };

  const removeTab = (locale: string) => {
    setEntries((all) => all.filter((entry) => entry.locale !== locale));
    setActive('en');
  };

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setRefusal(null);
    // The ids come from the box as it is now, not from the last drawing of the dialog.
    const ids = parseRecipients(values.recipients ?? '').ids;
    try {
      const { created } = await sendNotifications(
        buildSendBody({ ids, entries, link: values.link, push: values.push }),
      );
      message.success(
        t('notifications.send.done', {
          count: typeof created === 'number' ? created : ids.length,
        }),
      );
      onSent();
      onClose();
    } catch (error) {
      const refused = { error, ids, edited: [] };
      setRefusal(refused);
      const first = Object.keys(refusalView(intl, t, refused).textErrors)[0]
        ?.split(':')
        .slice(1)
        .join(':');
      if (first && entries.some((entry) => entry.locale === first)) setActive(first);
    }
  });

  const submit = async () => {
    setAttempted(true);
    let formOk = true;
    try {
      await form.validateFields();
    } catch {
      formOk = false;
    }
    const bad = entries.find((entry) => Object.keys(problemsOfEntry(entry)).length > 0);
    if (bad) setActive(bad.locale);
    if (!formOk || bad) return;
    await run(form.getFieldsValue(true) as Values);
  };

  const tabLabel = (entry: Entry) => {
    const base =
      entry.locale === 'en' ? t('notifications.send.tabRequired', { locale: 'en' }) : entry.locale;
    return (
      <span
        dir="auto"
        style={hasError(entry) ? { color: 'var(--ant-color-error, #ff4d4f)' } : undefined}
      >
        {hasError(entry) ? `${base} (${t('notifications.send.tabError')})` : base}
      </span>
    );
  };

  const field = (entry: Entry, which: 'title' | 'body') => {
    const value = which === 'title' ? entry.title : entry.body;
    const max = which === 'title' ? MAX_TITLE : MAX_BODY;
    const problem = visibleProblems(entry)[which];
    const server = serverErrors[`${which}:${entry.locale}`];
    const error = server ?? problemText(which, problem, entry);
    const count = lengthOf(value);
    const label = t(
      which === 'title' ? 'notifications.send.titleLabel' : 'notifications.send.bodyLabel',
      {
        locale: entry.locale,
      },
    );
    const common = {
      'aria-label': label,
      placeholder: label,
      dir: 'auto' as const,
      status: error ? ('error' as const) : undefined,
      value,
      onChange: (event: { target: { value: string } }) =>
        update(
          entry.locale,
          which === 'title' ? { title: event.target.value } : { body: event.target.value },
        ),
    };
    return (
      <Flex vertical gap={2}>
        {which === 'title' ? (
          <Input {...common} />
        ) : (
          <Input.TextArea {...common} autoSize={{ minRows: 3, maxRows: 8 }} />
        )}
        <Flex justify="space-between" gap={8}>
          <Typography.Text type="danger" role={error ? 'alert' : undefined}>
            {error}
          </Typography.Text>
          <Typography.Text type={count > max ? 'danger' : 'secondary'}>
            {t('notifications.send.counter', { count, max })}
          </Typography.Text>
        </Flex>
      </Flex>
    );
  };

  const limit = recipientsProblem(parsed.ids.length, meta.maxRecipients);

  return (
    <Modal
      open
      title={t('notifications.send.title')}
      width={720}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('notifications.send.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={submit}
    >
      <Form
        form={form}
        name="sendNotification"
        layout="vertical"
        requiredMark={false}
        initialValues={{ recipients: '', link: { linkType: 'NONE', linkTarget: '' }, push: false }}
      >
        <RevalidateOnLocaleChange />
        <Typography.Paragraph type="secondary">
          {t('notifications.send.scope')}{' '}
          {access.canAccess('PUSH:SEND') ? (
            <Link to="/push/tasks">{t('notifications.page.scopeLink')}</Link>
          ) : null}
        </Typography.Paragraph>
        <Form.Item
          name="recipients"
          label={t('notifications.send.recipients')}
          extra={
            <Flex vertical>
              <span>{t('notifications.send.recipientsHelp')}</span>
              {typeof meta.maxRecipients === 'number' && meta.maxRecipients > 0 ? (
                <span>{t('notifications.send.recipientsMax', { max: meta.maxRecipients })}</span>
              ) : null}
              <span>{t('notifications.send.recipientsCount', { count: parsed.ids.length })}</span>
              {parsed.repeated > 0 ? (
                <span>
                  {t('notifications.send.recipientsRepeated', { count: parsed.repeated })}
                </span>
              ) : null}
            </Flex>
          }
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const { ids } = parseRecipients(value ?? '');
                const problem = recipientsProblem(ids.length, meta.maxRecipients);
                if (problem === 'empty')
                  throw new Error(t('notifications.send.recipientsRequired'));
                if (problem === 'tooMany') {
                  throw new Error(
                    t('notifications.send.recipientsTooMany', {
                      max: meta.maxRecipients as number,
                      count: ids.length,
                    }),
                  );
                }
              },
            },
          ]}
        >
          <Input.TextArea
            rows={6}
            dir="ltr"
            spellCheck={false}
            placeholder={t('notifications.send.recipientsPlaceholder')}
            style={{ overflowWrap: 'anywhere' }}
          />
        </Form.Item>
        {limit === 'tooMany' && !attempted ? (
          <Typography.Text type="danger">
            {t('notifications.send.recipientsTooMany', {
              max: meta.maxRecipients as number,
              count: parsed.ids.length,
            })}
          </Typography.Text>
        ) : null}
        <Typography.Text strong>{t('notifications.send.texts')}</Typography.Text>
        <Typography.Paragraph type="secondary">
          {t('notifications.send.textsHelp')}
        </Typography.Paragraph>
        <Tabs
          size="small"
          activeKey={active}
          onChange={setActive}
          items={entries.map((entry) => ({
            key: entry.locale,
            label: tabLabel(entry),
            children: (
              <Flex vertical gap={8}>
                {field(entry, 'title')}
                {field(entry, 'body')}
                {entry.locale === 'en' ? null : (
                  <div style={{ marginBottom: 8 }}>
                    <Button danger size="small" onClick={() => removeTab(entry.locale)}>
                      {t('notifications.send.removeLanguage', { locale: entry.locale })}
                    </Button>
                  </div>
                )}
              </Flex>
            ),
          }))}
        />
        <Flex gap={8} wrap align="start" style={{ marginBottom: 16 }}>
          <AutoComplete
            style={{ width: 280 }}
            aria-label={t('notifications.send.languagePlaceholder')}
            placeholder={t('notifications.send.languagePlaceholder')}
            options={suggestions}
            value={newLanguage}
            onChange={(value) => {
              setNewLanguage(value);
              setLanguageProblem(null);
            }}
          />
          <Button onClick={addTab}>{t('notifications.send.addLanguage')}</Button>
          {languageProblem ? (
            <Typography.Text type="danger">
              {t(
                languageProblem === 'DUPLICATE'
                  ? 'notifications.send.languageDuplicate'
                  : 'notifications.send.languageInvalid',
              )}
            </Typography.Text>
          ) : null}
        </Flex>
        <Form.Item
          name="link"
          label={t('notifications.send.link')}
          // The address box of the link control says what is wrong with a web address itself.
          rules={[linkTargetRule(intl, { quietUrl: true })]}
        >
          <LinkFieldBox />
        </Form.Item>
        <Form.Item name="push" valuePropName="checked" extra={t('notifications.send.pushHelp')}>
          <Checkbox>{t('notifications.send.push')}</Checkbox>
        </Form.Item>
      </Form>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={failure.text}
          description={
            <Flex vertical gap={4}>
              {failure.accountLines.length > 0 ? (
                <>
                  <span>{t('notifications.send.badAccounts')}</span>
                  <ul
                    style={{ margin: 0, paddingInlineStart: 20, maxHeight: 200, overflow: 'auto' }}
                  >
                    {failure.accountLines.map((line, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the lines are text and may repeat
                      <li key={index} dir="auto" style={{ overflowWrap: 'anywhere' }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {failure.lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the lines are text and may repeat
                <span key={index} style={{ overflowWrap: 'anywhere' }}>
                  {line}
                </span>
              ))}
              {failure.notSent ? <strong>{t('notifications.send.notSent')}</strong> : null}
              {failure.maybeSent ? <strong>{t('notifications.send.maybeSent')}</strong> : null}
            </Flex>
          }
        />
      ) : null}
    </Modal>
  );
}

/** What a refused or failed send shows under the form, in the language of this drawing. */
function refusalView(
  intl: ReturnType<typeof useIntl>,
  t: (id: string, values?: Record<string, string | number>) => string,
  refusal: Refusal,
): { failure: Failure; textErrors: Record<string, string> } {
  const { error: failed, text } = describeFailure(intl, refusal.error);
  const lines: string[] = [];
  const accountLines: string[] = [];
  const textErrors: Record<string, string> = {};
  for (const detail of failed.details) {
    const reason = reasonText(intl, detail.reason);
    const place = languageRef(detail.ref);
    if (place) {
      textErrors[`${place.field}:${place.locale}`] = reason;
      lines.push(
        t('notifications.send.detailLine', {
          field: t(`notifications.send.ref.${place.field === 'title' ? 'titleI18n' : 'bodyI18n'}`),
          reason,
        }),
      );
    } else if (FIELD_REFS.includes(detail.ref)) {
      lines.push(
        t('notifications.send.detailLine', {
          field: t(`notifications.send.ref.${detail.ref}`),
          reason,
        }),
      );
    } else if (refusal.ids.includes(detail.ref)) {
      accountLines.push(t('notifications.send.accountLine', { id: visibleId(detail.ref), reason }));
    } else {
      lines.push(t('notifications.send.detailLine', { field: plainText(detail.ref), reason }));
    }
  }
  return {
    failure: {
      text,
      notSent: failed.code === 'INVALID_REQUEST' && failed.httpStatus === 400,
      maybeSent: isOutcomeUnknown(failed),
      lines,
      accountLines,
    },
    textErrors,
  };
}

/** The shared link control in a box a test can find. */
function LinkFieldBox(props: {
  value?: LinkTargetValue;
  onChange?: (value: LinkTargetValue) => void;
}) {
  return (
    <div data-testid="link-field">
      <LinkTargetField {...props} />
    </div>
  );
}
