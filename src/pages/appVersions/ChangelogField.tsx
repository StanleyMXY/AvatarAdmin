import { useIntl } from '@umijs/max';
import { Input, Tabs } from 'antd';
import { useAdminMeta } from '../../session/useSession';
import { changelogTags, type Texts } from './versionRules';

type Props = {
  value?: Texts;
  onChange?: (value: Texts) => void;
  disabled?: boolean;
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
export function ChangelogField({ value, onChange, disabled }: Props) {
  const intl = useIntl();
  const meta = useAdminMeta() as { supportedLocales?: unknown } | null;
  const texts = value ?? {};
  const supported = Array.isArray(meta?.supportedLocales)
    ? (meta.supportedLocales as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const tags = changelogTags(supported, texts);
  const set = (tag: string, text: string) => onChange?.({ ...texts, [tag]: text });

  return (
    <Tabs
      size="small"
      items={tags.map((tag) => ({
        key: tag,
        label: (
          <span>
            {tag}
            {tag === 'en' ? (
              <small> · {intl.formatMessage({ id: 'appVersions.changelogRequiredTab' })}</small>
            ) : null}
            <br />
            <small>{languageName(tag, intl.locale)}</small>
          </span>
        ),
        children: (
          <Input.TextArea
            value={typeof texts[tag] === 'string' ? texts[tag] : ''}
            disabled={disabled}
            rows={5}
            dir="auto"
            aria-label={tag}
            onChange={(event) => set(tag, event.target.value)}
          />
        ),
      }))}
    />
  );
}
