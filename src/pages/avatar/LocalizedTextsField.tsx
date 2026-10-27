import { useIntl } from '@umijs/max';
import { Flex, Input, Typography } from 'antd';
import { useAdminMeta } from '../../session/useSession';
import { languageName, languageTags, type Texts } from './localized';

type Props = {
  value?: Texts;
  onChange?: (value: Texts) => void;
  /** A text area for each language (a declaration) instead of a line. */
  multiline?: boolean;
  disabled?: boolean;
};

/**
 * One box per language: English, the languages the deployment supports (`supportedLocales` of
 * `GET /meta`), and any language the stored value already has. Fits an Ant Design form item; the
 * value keeps what was typed (empty boxes included), `cleanTexts` makes the request body of it.
 */
export function LocalizedTextsField({ value, onChange, multiline, disabled }: Props) {
  const intl = useIntl();
  const meta = useAdminMeta();
  const texts = value ?? {};
  const tags = languageTags(meta.supportedLocales, texts);
  const set = (tag: string, text: string) => onChange?.({ ...texts, [tag]: text });

  return (
    <Flex vertical gap={8}>
      {tags.map((tag) => {
        const props = {
          value: texts[tag] ?? '',
          disabled,
          dir: 'auto' as const,
          'aria-label': tag,
        };
        return (
          <Flex key={tag} gap={8} align={multiline ? 'start' : 'center'}>
            <Typography.Text style={{ minWidth: 96 }} type="secondary">
              {tag}
              <br />
              <small>{languageName(tag, intl.locale)}</small>
            </Typography.Text>
            {multiline ? (
              <Input.TextArea
                {...props}
                rows={3}
                onChange={(event) => set(tag, event.target.value)}
              />
            ) : (
              <Input {...props} onChange={(event) => set(tag, event.target.value)} />
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}
