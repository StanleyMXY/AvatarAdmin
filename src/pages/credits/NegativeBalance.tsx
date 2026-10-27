import { useIntl } from '@umijs/max';
import { Typography } from 'antd';
import { DASH, formatCount } from '../../utils/ratio';

type Props = {
  value: number | null | undefined;
  /** Write the sentence about what a negative balance means under the number (the account view does). */
  withNote?: boolean;
};

/**
 * A credit balance. Below zero it is in the warning colour and means: nothing can be spent, and
 * credits bought later are used to pay it off first (contract 15.9, a product decision). The
 * sentence is under the number when `withNote` is set, and in the tooltip of the number otherwise.
 */
export function NegativeBalance({ value, withNote }: Props) {
  const intl = useIntl();
  const known = typeof value === 'number' && Number.isFinite(value);
  const negative = known && value < 0;
  const note = intl.formatMessage({ id: 'credits.negative.note' });
  return (
    <span>
      <Typography.Text
        data-testid="balance"
        data-negative={String(negative)}
        type={negative ? 'danger' : undefined}
        strong={negative}
        title={negative ? note : undefined}
      >
        {known ? formatCount(value, intl.locale) : DASH}
      </Typography.Text>
      {negative && withNote ? (
        <div>
          <Typography.Text type="danger">{note}</Typography.Text>
        </div>
      ) : null}
    </span>
  );
}
