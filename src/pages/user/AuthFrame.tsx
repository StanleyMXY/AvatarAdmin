import { useIntl } from '@umijs/max';
import { Card, Flex, Typography, theme } from 'antd';
import type { ReactNode } from 'react';
import { buildVars } from '../../buildVars';
import { LangSwitch } from '../../components/layout/LangSwitch';
import { ThemeSwitch } from '../../components/layout/ThemeSwitch';

/**
 * The frame of the pages that have no menu: sign-in, authenticator setup, the forced password
 * change. The language and theme switches are here because the shell's header is not.
 */
export function AuthFrame({ titleId, children }: { titleId: string; children: ReactNode }) {
  const intl = useIntl();
  const { token } = theme.useToken();
  return (
    <Flex
      data-testid="auth-frame"
      vertical
      align="center"
      style={{
        // The frame is the window: it does not depend on the margin of the page body (8px by default,
        // which with a height of 100vh gave the document a scroll bar and a border of another colour),
        // and it scrolls inside itself when the card is taller than the window.
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        padding: 16,
        background: token.colorBgLayout,
      }}
    >
      <Flex gap={8} style={{ position: 'absolute', top: 12, insetInlineEnd: 16 }}>
        <LangSwitch />
        <ThemeSwitch />
      </Flex>
      {/* Centred with automatic margins: `justify-content: center` would cut off the top of a card taller than the window. */}
      <Card style={{ width: '100%', maxWidth: 400, margin: 'auto' }}>
        <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
          <img src={buildVars.logoUrl} alt="" width={48} height={48} />
          <Typography.Text strong>{buildVars.productName}</Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {intl.formatMessage({ id: titleId })}
          </Typography.Title>
        </Flex>
        {children}
      </Card>
    </Flex>
  );
}
