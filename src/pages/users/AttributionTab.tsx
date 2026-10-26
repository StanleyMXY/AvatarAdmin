import { useIntl } from '@umijs/max';
import { Descriptions, Empty } from 'antd';
import type { Attribution } from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';

/** 归因: where the account came from, or the sentence that there is no attribution record. */
export function AttributionTab({ attribution }: { attribution: Attribution | null }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  if (attribution === null || typeof attribution !== 'object') {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('users.attribution.none')} />;
  }
  const when = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? DASH : formatInstant(text, intl.locale);
  };
  const item = (key: keyof Attribution, content: React.ReactNode) => ({
    key,
    label: t(`users.attribution.${key}`),
    children: <span data-testid={`field-attribution-${key}`}>{content}</span>,
  });
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, md: 2 }}
      items={[
        item('source', <Cell value={attribution.source} />),
        item('matchType', <Cell value={attribution.matchType} />),
        item('mediaSource', <Cell value={attribution.mediaSource} />),
        item('campaign', <Cell value={attribution.campaign} />),
        item('installTime', when(attribution.installTime)),
        item('registeredAt', when(attribution.registeredAt)),
      ]}
    />
  );
}
