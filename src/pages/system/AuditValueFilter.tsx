import { useIntl } from '@umijs/max';
import { plainText } from '../../utils/plainText';
import { ChoiceOrTyped } from './ChoiceOrTyped';

type Props = {
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** The values `GET /audit-logs/meta` listed; null while they are read or when they could not be. */
  values: readonly string[] | null;
  loading: boolean;
  /** Which of the two filters this is. */
  kind: 'action' | 'targetType';
};

// What the backend takes in these filters; longer text is answered 400.
const MAX_LENGTH = 64;

/**
 * The filter "action" or "object type" of the audit log: a choice from the values the backend lists
 * (`GET /audit-logs/meta`), used exactly as they are, case included (four object types are in
 * capitals, the rest in camel case), with "Other" for a value the backend no longer lists (rows
 * written under an old name are still in the log).
 */
export function AuditValueFilter({ value, onChange, values, loading, kind }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <ChoiceOrTyped
      value={value}
      onChange={onChange}
      options={(values ?? []).map((text) => ({ value: text, label: plainText(text) }))}
      loading={loading}
      unavailable={!loading && values === null}
      label={t(`system.audit.filter.${kind}`)}
      typedLabel={t(`system.audit.filter.${kind}Typed`)}
      placeholder={t('system.audit.filter.pick')}
      otherText={t('system.audit.filter.other')}
      maxLength={MAX_LENGTH}
    />
  );
}
