import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Input, Tabs, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useAdminMeta } from '../../session/useSession';
import { changelogTags, type Texts } from './versionRules';

type Props = {
  value?: Texts;
  onChange?: (value: Texts) => void;
  disabled?: boolean;
  /** Why the backend refused the notes of a language (`changelog.<language>`), by language: shown under that language's text. */
  reasons?: Record<string, string>;
  /** The text of a language was edited: its reason is no longer true. */
  onEdited?: (tag: string) => void;
};

/** The name of a language in the interface language, or the tag itself when the browser does not know it. */
function languageName(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * The update notes of a version: one tab for each language. English is first and is required; then
 * the languages the deployment supports (`supportedLocales` of `GET /meta`), then any language the
 * notes already have. The value keeps what was typed, empty languages included; `cleanChangelog`
 * makes the request body of it. Fits an Ant Design form item.
 */
export function ChangelogField({ value, onChange, disabled, reasons = {}, onEdited }: Props) {
  const intl = useIntl();
  const meta = useAdminMeta() as { supportedLocales?: unknown } | null;
  const texts = value ?? {};
  const supported = Array.isArray(meta?.supportedLocales)
    ? (meta.supportedLocales as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const tags = changelogTags(supported, texts);
  const set = (tag: string, text: string) => {
    onChange?.({ ...texts, [tag]: text });
    onEdited?.(tag);
  };
  const refused = Object.keys(reasons);
  const firstRefused = tags.find((tag) => refused.includes(tag));
  const [active, setActive] = useState('en');
  // A refusal brings the first refused language into view; the others carry a mark on their tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new refusal moves the tab
  useEffect(() => {
    if (firstRefused !== undefined) setActive(firstRefused);
  }, [refused.length === 0 ? '' : refused.join('\n')]);
  // A reason for a language that has no tab (the person has taken it out) is still said, below the tabs.
  const strays = refused.filter((tag) => !tags.includes(tag));

  return (
    <>
      <Tabs
        size="small"
        activeKey={tags.includes(active) ? active : 'en'}
        onChange={setActive}
        items={tags.map((tag) => ({
          key: tag,
          label: (
            <span>
              {tag}
              {reasons[tag] !== undefined ? (
                <ExclamationCircleOutlined
                  data-testid={`note-refused-${tag}`}
                  aria-label={intl.formatMessage({ id: 'appVersions.noteRefused' })}
                  aria-hidden={false}
                  style={{ marginInlineStart: 4, color: 'var(--ant-color-error)' }}
                />
              ) : null}
              {tag === 'en' ? (
                <small> · {intl.formatMessage({ id: 'appVersions.changelogRequiredTab' })}</small>
              ) : null}
              <br />
              <small>{languageName(tag, intl.locale)}</small>
            </span>
          ),
          children: (
            <>
              <Input.TextArea
                value={typeof texts[tag] === 'string' ? texts[tag] : ''}
                disabled={disabled}
                rows={5}
                dir="auto"
                aria-label={tag}
                status={reasons[tag] !== undefined ? 'error' : undefined}
                onChange={(event) => set(tag, event.target.value)}
              />
              {reasons[tag] !== undefined ? (
                <Typography.Text type="danger" role="alert" data-testid={`note-reason-${tag}`}>
                  {reasons[tag]}
                </Typography.Text>
              ) : null}
            </>
          ),
        }))}
      />
      {strays.map((tag) => (
        <Typography.Text key={tag} type="danger" role="alert" style={{ display: 'block' }}>
          {intl.formatMessage(
            { id: 'appVersions.changelogLanguageReason' },
            { language: tag, reason: reasons[tag] },
          )}
        </Typography.Text>
      ))}
    </>
  );
}
