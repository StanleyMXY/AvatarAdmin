import { Link, useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Descriptions,
  Drawer,
  Flex,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type ClientConfigItem,
  readClientConfigKey,
  resetClientConfig,
  saveClientConfig,
} from '../../services/clientConfig';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import {
  addLanguage,
  type Draft,
  draftOf,
  emptyValue,
  isChanged,
  problemsOf,
  removeLanguage,
  setValue,
  valuesOf,
} from './editorState';
import { PreviewBox } from './PreviewBox';
import {
  adminText,
  formatValue,
  instantText,
  keyText,
  problemText,
  readOnlyNote,
  typeText,
} from './texts';
import { ValueControl } from './ValueControl';
import { sameVersion } from './version';

type Props = {
  item: ClientConfigItem;
  /** The administrator may change this key: CLIENTCONFIG:MANAGE, and the key is not read only. */
  editable: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A tab key for a language; the default value's language tag is empty, which a tab key cannot be. */
const tabKey = (locale: string) => (locale === '' ? '__default__' : `lang:${locale}`);

/**
 * The editor of one key, in a drawer the page mounts only while it is open. A key is saved as a
 * whole: every language is checked first, and one that fails stops the save of all of them. The
 * preview resolves the value of a chosen language the way the client's request would.
 */
export function ClientConfigEditor({ item: opened, editable, onClose, onChanged }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const meta = useAdminMeta();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  // The key as this editor last read it: what the open drawer compares the backend with before a save.
  const [item, setItem] = useState(opened);
  const key = plainText(item.key);
  const type = plainText(item.type);

  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  const [active, setActive] = useState(() => tabKey(draftOf(item)[0]?.locale ?? ''));
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [languageProblem, setLanguageProblem] = useState<string | null>(null);

  const changed = isChanged(item, draft);
  const problems = problemsOf(type, draft);
  const problemOf = (locale: string) => problems.find((p) => p.locale === locale);
  const errorOf = (locale: string): string | null => {
    if (locale in serverErrors) return serverErrors[locale];
    const found = problemOf(locale);
    return attempted && found ? problemText(intl, found.reason) : null;
  };
  const hasDefault = draft.some((entry) => entry.locale === '');

  const edit = (locale: string, value: unknown) => {
    setDraft((all) => setValue(all, locale, value));
    setServerErrors((errors) => {
      const next = { ...errors };
      delete next[locale];
      return next;
    });
  };

  const add = (raw: string, isDefault: boolean) => {
    const result = addLanguage(draft, raw, { allowDefault: isDefault, initial: emptyValue(type) });
    if (!result.ok) {
      setLanguageProblem(
        t(
          result.problem === 'DUPLICATE'
            ? 'clientConfig.editor.languageDuplicate'
            : 'clientConfig.editor.languageInvalid',
        ),
      );
      return;
    }
    setLanguageProblem(null);
    setDraft(result.draft);
    setActive(tabKey(isDefault ? '' : raw.trim()));
    setNewLanguage('');
  };

  const remove = (locale: string) => {
    const rest = removeLanguage(draft, locale);
    setDraft(rest);
    setActive(tabKey(rest[0]?.locale ?? ''));
  };

  const { run: save, pending } = useSingleFlight(async () => {
    setFailure(null);
    setRefused(false);
    setConflict(false);
    setAttempted(true);
    if (problems.length > 0) {
      const first = problems.find((p) => p.locale !== null);
      if (first?.locale !== undefined && first.locale !== null) setActive(tabKey(first.locale));
      return;
    }
    // A key is saved as a whole, so a save over a newer version would delete what the other
    // administrator added. Read the key again; if it is no longer the one that was opened, stop.
    try {
      if (!sameVersion(item, await readClientConfigKey(key))) {
        setConflict(true);
        return;
      }
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
      return;
    }
    try {
      await saveClientConfig(key, valuesOf(type, draft));
    } catch (error) {
      const { error: failed, text } = describeFailure(intl, error);
      const byLanguage: Record<string, string> = {};
      for (const detail of failed.details) {
        // The contract (1.4) writes the value without a language as `default`; its entry has the empty tag.
        const tag = detail.ref === 'default' ? '' : detail.ref;
        if (draft.some((entry) => entry.locale === tag)) {
          byLanguage[tag] = problemText(intl, detail.reason);
        }
      }
      setServerErrors(byLanguage);
      const first = Object.keys(byLanguage)[0];
      if (first !== undefined) setActive(tabKey(first));
      setRefused(Object.keys(byLanguage).length > 0);
      setFailure(text);
      return;
    }
    message.success(t('clientConfig.editor.saved'));
    onChanged();
    onClose();
  });

  // Takes the key as the backend has it now and drops the edit, the tabs and the marks on them.
  const { run: reload, pending: reloading } = useSingleFlight(async () => {
    setFailure(null);
    let fresh: ClientConfigItem | undefined;
    try {
      fresh = await readClientConfigKey(key);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
      return;
    }
    if (!fresh) {
      setFailure(t('error.RESOURCE_NOT_FOUND'));
      return;
    }
    setItem(fresh);
    setDraft(draftOf(fresh));
    setActive(tabKey(draftOf(fresh)[0]?.locale ?? ''));
    setAttempted(false);
    setServerErrors({});
    setRefused(false);
    setConflict(false);
    onChanged();
  });

  // A reset deletes every language of the key, also what another administrator saved after this
  // editor opened, so it is checked like a save: the key is read again and must be the one opened.
  const resetKey = async () => {
    setFailure(null);
    setRefused(false);
    setConflict(false);
    try {
      if (!sameVersion(item, await readClientConfigKey(key))) {
        setConflict(true);
        return;
      }
      await resetClientConfig(key);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
      return;
    }
    message.success(t('clientConfig.reset.done'));
    onChanged();
    onClose();
  };

  const supported = (Array.isArray(meta.supportedLocales) ? meta.supportedLocales : [])
    .filter((tag): tag is string => typeof tag === 'string')
    .filter((tag) => !draft.some((entry) => entry.locale.toLowerCase() === tag.toLowerCase()))
    .map((tag) => ({ value: tag }));

  const languageLabel = (locale: string) =>
    locale === '' ? t('clientConfig.editor.default') : locale;
  const failedCount = problems.filter((p) => p.locale !== null).length;

  // What the preview resolves: the values as edited, or as stored when the key is only looked at.
  const previewItem = editable
    ? {
        values: valuesOf(type, draft),
        localized: item.localized === true,
        defaultValue: item.defaultValue,
      }
    : { values: item.values, localized: item.localized === true, defaultValue: item.defaultValue };
  const rawValues = isPlainObject(item.values) ? item.values : {};
  const rawTags = Object.keys(rawValues).sort((a, b) =>
    a === '' ? -1 : b === '' ? 1 : a < b ? -1 : 1,
  );

  const manageSystemConfig = access.canAccess('CONFIG:MANAGE');

  return (
    <Drawer
      open
      size="large"
      title={t('clientConfig.editor.title', { key })}
      destroyOnHidden
      mask={{ closable: false }}
      onClose={pending ? undefined : onClose}
      footer={
        editable ? (
          <Flex gap={8} align="center" wrap justify="space-between">
            <Flex gap={8} align="center" wrap>
              <Button
                type="primary"
                loading={pending}
                disabled={pending || !changed}
                onClick={() => save()}
              >
                {t('clientConfig.editor.save')}
              </Button>
              {changed ? null : (
                <Typography.Text type="secondary">
                  {t('clientConfig.editor.unchanged')}
                </Typography.Text>
              )}
            </Flex>
            <Flex gap={8} align="center" wrap>
              {item.configured === true ? null : (
                <Typography.Text type="secondary">
                  {t('clientConfig.reset.nothing')}
                </Typography.Text>
              )}
              <DangerConfirmButton
                confirmText={t('clientConfig.reset.confirm', { key })}
                onConfirm={resetKey}
                disabled={item.configured !== true || pending}
              >
                {t('clientConfig.reset.button')}
              </DangerConfirmButton>
            </Flex>
          </Flex>
        ) : null
      }
    >
      <Flex vertical gap={16}>
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: 'desc',
              label: t('clientConfig.col.desc'),
              children: (
                <span style={{ overflowWrap: 'anywhere' }}>{keyText(intl, key, 'desc')}</span>
              ),
            },
            {
              key: 'usage',
              label: t('clientConfig.col.usage'),
              children: (
                <span style={{ overflowWrap: 'anywhere' }}>{keyText(intl, key, 'usage')}</span>
              ),
            },
            { key: 'type', label: t('clientConfig.col.type'), children: typeText(intl, type) },
          ]}
        />
        {typeof item.updatedAt === 'string' && item.updatedAt !== '' ? (
          <Typography.Text type="secondary">
            {t('clientConfig.editor.updated', {
              who: adminText(item.updatedByUsername, item.updatedBy),
              when: instantText(intl.locale, item.updatedAt),
            })}
          </Typography.Text>
        ) : null}
        {item.readOnly === true ? (
          <Alert
            type="info"
            showIcon
            title={
              <span>
                {readOnlyNote(intl, key)}{' '}
                {manageSystemConfig ? (
                  <Link to="/config">{t('clientConfig.readOnly.link')}</Link>
                ) : null}
              </span>
            }
          />
        ) : type === 'STRING_LIST' ? (
          <Alert type="info" showIcon title={t('clientConfig.derived.note')} />
        ) : null}
        {failure ? (
          <Alert
            type="error"
            showIcon
            title={failure}
            description={refused ? t('clientConfig.editor.refused') : undefined}
          />
        ) : null}
        {conflict ? (
          <Alert
            type="warning"
            showIcon
            title={t('clientConfig.editor.conflict')}
            description={t('clientConfig.editor.conflictDetail')}
            action={
              <Button size="small" loading={reloading} onClick={() => reload()}>
                {t('clientConfig.editor.conflictReload')}
              </Button>
            }
          />
        ) : null}
        {attempted && failedCount > 0 ? (
          <Alert
            type="error"
            showIcon
            title={t('clientConfig.editor.problems', { count: failedCount })}
          />
        ) : null}
        {attempted && problems.some((p) => p.locale === null) ? (
          <Alert type="error" showIcon title={t('clientConfig.editor.noValue')} />
        ) : null}

        {editable ? (
          <Flex vertical gap={8}>
            <Typography.Text strong>{t('clientConfig.editor.values')}</Typography.Text>
            {item.localized === true ? null : (
              <Typography.Text type="secondary">
                {t('clientConfig.editor.notLocalized')}
              </Typography.Text>
            )}
            {draft.length === 0 ? (
              <Typography.Text type="secondary">{t('clientConfig.editor.empty')}</Typography.Text>
            ) : (
              <Tabs
                size="small"
                activeKey={active}
                onChange={setActive}
                items={draft.map((entry) => {
                  const error = errorOf(entry.locale);
                  const label = languageLabel(entry.locale);
                  return {
                    key: tabKey(entry.locale),
                    label: (
                      <span
                        dir="auto"
                        style={error ? { color: 'var(--ant-color-error, #ff4d4f)' } : undefined}
                      >
                        {error ? `${label} (${t('clientConfig.editor.tabError')})` : label}
                      </span>
                    ),
                    children: (
                      <Flex vertical gap={8}>
                        {entry.locale === '' && item.localized === true ? (
                          <Typography.Text type="secondary">
                            {t('clientConfig.editor.defaultHelp')}
                          </Typography.Text>
                        ) : null}
                        <ValueControl
                          type={type}
                          value={entry.value}
                          label={t('clientConfig.editor.valueLabel', { language: label })}
                          error={error !== null}
                          onChange={(value) => edit(entry.locale, value)}
                        />
                        {error ? (
                          <Typography.Text type="danger" role="alert">
                            {error}
                          </Typography.Text>
                        ) : null}
                        {draft.length > 1 ? (
                          <Flex gap={8} align="center" wrap>
                            <Button danger size="small" onClick={() => remove(entry.locale)}>
                              {t('clientConfig.editor.removeLanguage')}
                            </Button>
                            {entry.locale === '' ? null : (
                              <Typography.Text type="secondary">
                                {t('clientConfig.editor.removeHelp')}
                              </Typography.Text>
                            )}
                          </Flex>
                        ) : null}
                      </Flex>
                    ),
                  };
                })}
              />
            )}
            {hasDefault ? null : (
              <div>
                <Button onClick={() => add('', true)}>{t('clientConfig.editor.addDefault')}</Button>
              </div>
            )}
            {item.localized === true ? (
              <Flex gap={8} wrap align="start">
                <AutoComplete
                  style={{ width: 280 }}
                  aria-label={t('clientConfig.editor.languagePlaceholder')}
                  placeholder={t('clientConfig.editor.languagePlaceholder')}
                  options={supported}
                  value={newLanguage}
                  onChange={(value) => {
                    setNewLanguage(value);
                    setLanguageProblem(null);
                  }}
                />
                <Button onClick={() => add(newLanguage, false)}>
                  {t('clientConfig.editor.addLanguage')}
                </Button>
                {languageProblem ? (
                  <Typography.Text type="danger">{languageProblem}</Typography.Text>
                ) : null}
              </Flex>
            ) : null}
          </Flex>
        ) : (
          <Flex vertical gap={8}>
            <Typography.Text strong>{t('clientConfig.editor.values')}</Typography.Text>
            {rawTags.length === 0 ? (
              <Typography.Text type="secondary">{t('clientConfig.editor.empty')}</Typography.Text>
            ) : (
              rawTags.map((tag) => (
                <Flex key={tag} gap={8} align="start">
                  <Tag style={{ unicodeBidi: 'plaintext' }}>{languageLabel(tag)}</Tag>
                  <span
                    data-testid={`readonly-value-${tag === '' ? 'default' : tag}`}
                    dir="auto"
                    style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                  >
                    {formatValue(intl, rawValues[tag])}
                  </span>
                </Flex>
              ))
            )}
          </Flex>
        )}
        <PreviewBox
          item={previewItem as Pick<ClientConfigItem, 'values' | 'localized' | 'defaultValue'>}
          tags={editable ? draft.map((entry) => entry.locale) : rawTags}
          unsaved={editable && changed}
        />
      </Flex>
    </Drawer>
  );
}
