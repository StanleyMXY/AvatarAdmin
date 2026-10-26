import { useIntl } from '@umijs/max';
import { Space, Typography } from 'antd';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/**
 * An account id with a copy button. The id can be any text, so it is broken anywhere and cut to two
 * lines: a long one never widens or lengthens a row (the whole id is the tooltip and is what is copied).
 */
export function CopyableId({ value }: { value: unknown }) {
  const intl = useIntl();
  const text = plainText(value);
  if (text === '') return <span>{DASH}</span>;
  return (
    <Space size={4} align="start" wrap={false}>
      <span
        dir="auto"
        data-lines="2"
        title={text}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: 240,
          overflowWrap: 'anywhere',
          wordBreak: 'break-all',
        }}
      >
        {text}
      </span>
      <Typography.Text
        copyable={{ text, tooltips: [intl.formatMessage({ id: 'activity.common.copyId' }), false] }}
      />
    </Space>
  );
}
