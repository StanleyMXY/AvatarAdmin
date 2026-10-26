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
      vertical
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 16,
        position: 'relative',
        background: token.colorBgLayout,
      }}
    >
      <Flex gap={8} style={{ position: 'absolute', top: 12, insetInlineEnd: 16 }}>
        <LangSwitch />
        <ThemeSwitch />
      </Flex>
      <Card style={{ width: '100%', maxWidth: 400 }}>
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
