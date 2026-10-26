import { useIntl } from '@umijs/max';
import { AutoComplete, Flex, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { ClientConfigItem } from '../../services/clientConfig';
import { useAdminMeta } from '../../session/useSession';
import { type PreviewSource, resolvePreview } from './preview';
import { formatValue } from './texts';

type Props = {
  /** The key as it would be after the edit: the values to resolve, whether it is per language, its registered default. */
  item: Pick<ClientConfigItem, 'values' | 'localized' | 'defaultValue'>;
  /** Language tags worth suggesting besides the ones of GET /meta. */
  tags: string[];
  /** The edit has changes that are not saved. */
  unsaved: boolean;
};

const COLORS: Record<PreviewSource, string | undefined> = {
  LANGUAGE: 'green',
  DEFAULT: 'blue',
  UNSET: 'default',
};

/**
 * 预览: the value the client gets for one language and where it comes from: that language, the
 * default value, or nowhere (not configured). It follows the language negotiation of the contract.
 */
export function PreviewBox({ item, tags, unsaved }: Props) {
  const intl = useIntl();
  const meta = useAdminMeta();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const supported = (Array.isArray(meta.supportedLocales) ? meta.supportedLocales : []).filter(
    (tag): tag is string => typeof tag === 'string',
  );
  const [language, setLanguage] = useState(supported[0] ?? 'en');
  const result = resolvePreview(item, language);
  const options = [...new Set([...tags, ...supported])]
    .filter((tag) => tag !== '')
    .map((value) => ({ value }));
  const from =
    result.source === 'LANGUAGE'
      ? t('clientConfig.preview.from.LANGUAGE', { tag: result.matched ?? '' })
      : result.source === 'DEFAULT'
        ? t(
            result.matched === ''
              ? 'clientConfig.preview.from.DEFAULT_ROW'
              : 'clientConfig.preview.from.DEFAULT_REGISTERED',
          )
        : t('clientConfig.preview.from.UNSET');

  return (
    <Flex vertical gap={8}>
      <Typography.Text strong>{t('clientConfig.preview.title')}</Typography.Text>
      <Typography.Text type="secondary">{t('clientConfig.preview.help')}</Typography.Text>
      <AutoComplete
        style={{ width: 240 }}
        aria-label={t('clientConfig.preview.language')}
        placeholder={t('clientConfig.preview.language')}
        options={options}
        value={language}
        onChange={setLanguage}
      />
      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{t('clientConfig.preview.value')}</Typography.Text>
        <div
          data-testid="preview-value"
          dir="auto"
          style={{
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {formatValue(intl, result.value)}
        </div>
        <Flex gap={8} align="center" wrap>
          <Typography.Text type="secondary">{t('clientConfig.preview.source')}</Typography.Text>
          <Tag data-testid="preview-source" color={COLORS[result.source]}>
            {t(`clientConfig.preview.source.${result.source}`)}
          </Tag>
          <Typography.Text data-testid="preview-from" type="secondary">
            {from}
          </Typography.Text>
        </Flex>
        {unsaved ? (
          <Typography.Text type="warning">{t('clientConfig.preview.unsaved')}</Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  );
}
