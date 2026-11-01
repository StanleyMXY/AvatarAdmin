import { Flex, Typography } from 'antd';

/**
 * What a dialog that asks for a note is about (the model, the currency, the date the price starts),
 * then the consequence of the action. Without it the dialogs of two different batches look the
 * same, and a withdrawal changes what later requests cost.
 */
export function BatchSummary({ summary, consequence }: { summary: string; consequence: string }) {
  return (
    <Flex vertical gap={4}>
      <Typography.Text
        strong
        data-testid="batch-summary"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {summary}
      </Typography.Text>
      <span>{consequence}</span>
    </Flex>
  );
}
