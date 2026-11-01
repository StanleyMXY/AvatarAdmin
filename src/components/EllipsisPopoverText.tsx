import { useIntl } from '@umijs/max';
import { App, Button, Popover, Space } from 'antd';
import { type CSSProperties, useState } from 'react';

type Props = {
  text: string | null | undefined;
  /** Lines shown before the text is cut with an ellipsis (default 2). */
  lines?: number;
  width?: number | string;
  /**
   * Text direction. Left as `auto`, each text picks its own from its first strong letter, which is
   * right for prose. An identifier (a masked e-mail, a code, an account id) is read from the left
   * whatever it starts with, so it passes `ltr`: otherwise `م***@y***.com` is laid out as
   * `y***.com@***م`.
   */
  dir?: 'auto' | 'ltr';
};

const WRAP: CSSProperties = {
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
};

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('no clipboard');
}

/**
 * Long text in a table cell: cut to a few lines, the whole text in a popover on click, with a copy
 * button. Words are broken anywhere, so Thai and Arabic text, an emoji run or a string without
 * spaces never widens the table.
 */
export function EllipsisPopoverText({ text, lines = 2, width = 240, dir = 'auto' }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  if (text === null || text === undefined || text === '') return <span>—</span>;

  const copy = async () => {
    try {
      await writeClipboard(text);
      message.success(intl.formatMessage({ id: 'pages.common.copied' }));
    } catch {
      message.error(intl.formatMessage({ id: 'error.UNKNOWN' }));
    }
  };

  const full = (
    <Space orientation="vertical" size={8} style={{ maxWidth: 420 }}>
      <div dir={dir} data-testid="full-text" style={{ ...WRAP, maxHeight: 320, overflow: 'auto' }}>
        {text}
      </div>
      <Button size="small" onClick={copy}>
        {intl.formatMessage({ id: 'pages.common.copy' })}
      </Button>
    </Space>
  );

  return (
    <Popover trigger="click" open={open} onOpenChange={setOpen} content={full}>
      <button
        type="button"
        dir={dir}
        aria-expanded={open}
        title={intl.formatMessage({ id: 'pages.common.expand' })}
        data-lines={lines}
        style={{
          ...WRAP,
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: width,
          textAlign: 'start',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        {text}
      </button>
    </Popover>
  );
}
