import type { CSSProperties } from 'react';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/**
 * Text from the backend in a cell or a title: any type is written out (never thrown as a React
 * child), nothing is a dash, and a string of any length without spaces is broken anywhere so it
 * cannot widen the page. `dir="auto"` keeps Arabic right to left inside a left to right page.
 */
export function WrapText({
  value,
  testId,
  lines,
  style,
}: {
  value: unknown;
  testId?: string;
  /** Cut to this many lines (the whole text is still in the element). */
  lines?: number;
  style?: CSSProperties;
}) {
  const text = plainText(value);
  if (text === '') return <span>{DASH}</span>;
  return (
    <span
      dir="auto"
      data-testid={testId}
      title={lines ? text : undefined}
      style={{
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        ...(lines
          ? {
              display: '-webkit-box',
              WebkitLineClamp: lines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }
          : {}),
        ...style,
      }}
    >
      {text}
    </span>
  );
}

/** A price or amount as the decimal text it is: left to right whatever the page direction, a dash when there is none. */
export function Price({ value }: { value: string | null | undefined }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate', overflowWrap: 'anywhere' }}>
      {value === null || value === undefined || value === '' ? DASH : value}
    </span>
  );
}
