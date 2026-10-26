import { useIntl } from '@umijs/max';
import { Flex, Select } from 'antd';
import { SCREEN_TARGETS } from '../utils/screenTargets';
import { LinkInput } from './LinkInput';

export type LinkType = 'NONE' | 'SCREEN' | 'URL';
export type LinkTargetValue = { linkType: LinkType; linkTarget: string };

type Props = {
  value?: LinkTargetValue;
  onChange?: (value: LinkTargetValue) => void;
  disabled?: boolean;
};

const TYPES: readonly LinkType[] = ['NONE', 'SCREEN', 'URL'];

/** What a push, a notification or an ad opens: nothing, an app screen from the shared list, or an https link. */
export function LinkTargetField({
  value = { linkType: 'NONE', linkTarget: '' },
  onChange,
  disabled,
}: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Flex gap={8} wrap>
      <Select<LinkType>
        style={{ minWidth: 140 }}
        disabled={disabled}
        value={value.linkType}
        options={TYPES.map((type) => ({ value: type, label: t(`pages.link.type.${type}`) }))}
        // A target of one kind means nothing for another, so it is emptied.
        onChange={(linkType) => onChange?.({ linkType, linkTarget: '' })}
      />
      {value.linkType === 'SCREEN' ? (
        <Select<string>
          style={{ minWidth: 200 }}
          disabled={disabled}
          value={value.linkTarget === '' ? undefined : value.linkTarget}
          placeholder={t('pages.link.target.placeholderScreen')}
          options={SCREEN_TARGETS.map((id) => ({ value: id, label: t(`pages.link.screen.${id}`) }))}
          onChange={(linkTarget) => onChange?.({ linkType: 'SCREEN', linkTarget })}
        />
      ) : null}
      {value.linkType === 'URL' ? (
        <div style={{ minWidth: 280, flex: 1 }}>
          <LinkInput
            required
            disabled={disabled}
            value={value.linkTarget}
            placeholder={t('pages.link.target.placeholderUrl')}
            onChange={(linkTarget) => onChange?.({ linkType: 'URL', linkTarget })}
          />
        </div>
      ) : null}
    </Flex>
  );
}
