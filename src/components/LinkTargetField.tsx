import { useIntl } from '@umijs/max';
import { Flex, Select } from 'antd';
import { validateServerLink } from '../utils/linkRule';
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

/**
 * A rule for `Form.Item` around `LinkTargetField`: NONE needs nothing, SCREEN needs a screen of the
 * shared list, URL needs a link that passes the link rule (contract 1.7). The message is the
 * reason text of the problem, so the form cannot be submitted with a target the backend refuses.
 * With `quietUrl` a bad address carries no message (the form still cannot be sent): for a form where
 * the address box shows the reason itself, so that it is not written twice.
 */
export function linkTargetRule(
  intl: { formatMessage: (d: { id: string }) => string },
  options: { quietUrl?: boolean } = {},
) {
  return {
    validator: async (_: unknown, value: LinkTargetValue | undefined) => {
      const { linkType, linkTarget } = value ?? { linkType: 'NONE', linkTarget: '' };
      if (linkType === 'SCREEN' && !SCREEN_TARGETS.includes(linkTarget)) {
        throw new Error(intl.formatMessage({ id: 'pages.link.target.screenRequired' }));
      }
      if (linkType === 'URL') {
        const check = validateServerLink(linkTarget);
        // `quietUrl`: the address box beside it already says what is wrong, so the rule only blocks.
        if (!check.ok) {
          throw new Error(
            options.quietUrl ? '' : intl.formatMessage({ id: `reason.${check.reasonKey}` }),
          );
        }
      }
    },
  };
}

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
