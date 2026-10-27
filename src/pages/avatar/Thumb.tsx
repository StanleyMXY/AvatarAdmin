import { PictureOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useState } from 'react';

type Props = {
  /** A signed address, or `null` when the file is missing. */
  url: string | null | undefined;
  /** What the picture shows, for a screen reader. */
  alt: string;
  size?: number;
};

/**
 * A small picture from a signed address. The address is used as it came with this answer and is not
 * kept anywhere; a missing file (`null`) and an address that no longer works show the same placeholder.
 */
export function Thumb({ url, alt, size = 48 }: Props) {
  const intl = useIntl();
  const [broken, setBroken] = useState<string | null>(null);
  const box = {
    width: size,
    height: size,
    borderRadius: 6,
    flex: 'none',
  } as const;
  if (!url || broken === url) {
    return (
      <span
        role="img"
        aria-label={intl.formatMessage({ id: 'avatar.noPicture' })}
        data-testid="no-picture"
        style={{
          ...box,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed currentColor',
          opacity: 0.45,
        }}
      >
        <PictureOutlined />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      style={{ ...box, objectFit: 'cover' }}
      onError={() => setBroken(url)}
    />
  );
}
