import { useState } from 'react';
import { DASH } from '../../utils/ratio';

/**
 * The picture of a template, task or schedule, small. The address comes with the answer and is
 * used as it is; a missing one, one that is not text, and one that does not load show a dash.
 */
export function PushImage({ url, size = 48 }: { url: unknown; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (typeof url !== 'string' || url === '' || broken === url) return <span>{DASH}</span>;
  return (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover' }}
      onError={() => setBroken(url)}
    />
  );
}
