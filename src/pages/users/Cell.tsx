import { Typography } from 'antd';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/**
 * A value from the backend as one piece of text in a table cell or a description: any type is written
 * out (never thrown as a React child), nothing is a dash, and a string of any length without spaces
 * is broken anywhere and cut to a few lines so it cannot widen the table.
 */
export function Cell({ value, lines = 3 }: { value: unknown; lines?: number }) {
  const text = plainText(value);
  if (text === '') return <span>{DASH}</span>;
  return (
    <Typography.Text
      dir="auto"
      title={text.length > 80 ? text : undefined}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        maxWidth: 280,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </Typography.Text>
  );
}
