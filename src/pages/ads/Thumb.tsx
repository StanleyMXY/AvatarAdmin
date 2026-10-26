import { useState } from 'react';
import { DASH } from '../../utils/ratio';

// An address the page puts into an <img>: the public https address of the backend, or a picture
// inlined in the answer. Anything else (another scheme, a value that is not text) is not drawn.
const DRAWABLE = /^(https:\/\/|data:image\/)/;

/** The thumbnail of a creative, small. A missing address, one that is not drawable and one that does not load show a dash. */
export function Thumb({ url, size = 48 }: { url: unknown; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (typeof url !== 'string' || !DRAWABLE.test(url) || broken === url) return <span>{DASH}</span>;
  return (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover' }}
      onError={() => setBroken(url)}
    />
  );
}
