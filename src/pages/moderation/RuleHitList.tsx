import { useIntl } from '@umijs/max';
import { Flex, Tag, Typography } from 'antd';
import type { ModerationRecord } from '../../services/moderation';
import { hasRuleWithoutHit, hitsOf } from './ruleHits';

/** The word rules a record matched: what each one matches, how, and its note. Never the id of a rule. */
export function RuleHitList({
  record,
}: {
  record: Pick<ModerationRecord, 'categories' | 'ruleHits'>;
}) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const hits = hitsOf(record);
  return (
    <Flex vertical gap={6} data-testid="rule-hits">
      {hits.map((hit) => (
        <Flex key={hit.ruleId} vertical gap={2}>
          <Flex gap={8} align="baseline" wrap>
            <Tag style={{ marginInlineEnd: 0 }}>
              {intl.messages[`moderation.rules.matchMode.${hit.matchMode}`]
                ? t(`moderation.rules.matchMode.${hit.matchMode}`)
                : hit.matchMode}
            </Tag>
            <Typography.Text code style={{ overflowWrap: 'anywhere' }}>
              {hit.pattern}
            </Typography.Text>
          </Flex>
          {hit.note ? (
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
              {hit.note}
            </Typography.Text>
          ) : null}
        </Flex>
      ))}
      {hasRuleWithoutHit(record) ? (
        <Typography.Text type="secondary">{t('moderation.ruleHit.unknown')}</Typography.Text>
      ) : null}
    </Flex>
  );
}
