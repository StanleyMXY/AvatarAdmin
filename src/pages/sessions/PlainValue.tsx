import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/**
 * A value from the backend as text in the details: any type is written out (never thrown as a React
 * child), nothing is a dash, and a string of any length without spaces is broken anywhere so it cannot
 * widen the drawer. `dir="auto"` keeps Arabic text right to left inside a left to right page.
 */
export function PlainValue({ value }: { value: unknown }) {
  const text = plainText(value);
  if (text === '') return <span>{DASH}</span>;
  return (
    <span dir="auto" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      {text}
    </span>
  );
}
