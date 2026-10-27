import { useIntl } from '@umijs/max';
import { Alert, Descriptions, Drawer, Flex, Spin, Tag, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { getNotification, type NotificationDetail } from '../../services/notifications';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { adminText, codeText, describeLink, instantText, orDash } from './texts';

/** Any text, any script, any length: broken anywhere, shown in its own direction, never wider than the drawer. */
const WRAP: CSSProperties = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** English first, then the other languages by tag. */
const languageOrder = (a: string, b: string) => {
  if (a === b) return 0;
  if (a === 'en') return -1;
  if (b === 'en') return 1;
  return a < b ? -1 : 1;
};

/** The detail of one notification: the title and body in every language, the template key and its parameters. */
export function NotificationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // The answer of an earlier row, arriving after the person has moved on, is dropped.
  useEffect(() => {
    let live = true;
    setDetail(null);
    setFailure(null);
    getNotification(id)
      .then((row) => {
        if (live) setDetail(row);
      })
      .catch((error) => {
        if (live) setFailure(describeFailure(intl, error).text);
      });
    return () => {
      live = false;
    };
  }, [id, intl]);

  const titles = isPlainObject(detail?.titleI18n) ? detail.titleI18n : {};
  const bodies = isPlainObject(detail?.bodyI18n) ? detail.bodyI18n : {};
  const tags = [...new Set([...Object.keys(titles), ...Object.keys(bodies)])].sort(languageOrder);
  const hasTemplate = detail?.templateKey != null || detail?.templateParams != null;
  const params = detail?.templateParams;

  return (
    <Drawer
      open
      onClose={onClose}
      size="large"
      title={t('notifications.detail.title', { id })}
      destroyOnHidden
    >
      {failure ? (
        <Alert type="error" showIcon title={t('pages.common.loadFailed', { message: failure })} />
      ) : null}
      {!detail && !failure ? <Spin /> : null}
      {detail ? (
        <Flex vertical gap={16}>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'account',
                label: t('notifications.detail.account'),
                children: <span style={WRAP}>{orDash(detail.accountId)}</span>,
              },
              {
                key: 'category',
                label: t('notifications.detail.category'),
                children: codeText(intl, 'notifications.category', detail.category) || DASH,
              },
              {
                key: 'read',
                label: t('notifications.detail.isRead'),
                children:
                  detail.isRead === true
                    ? t('notifications.read.yes')
                    : detail.isRead === false
                      ? t('notifications.read.no')
                      : DASH,
              },
              {
                key: 'sentBy',
                label: t('notifications.detail.sentBy'),
                children:
                  detail.category === 'SYSTEM_EVENT' && !detail.sentBy && !detail.sentByUsername
                    ? t('notifications.system')
                    : adminText(detail.sentByUsername, detail.sentBy),
              },
              {
                key: 'createdAt',
                label: t('notifications.detail.createdAt'),
                children: instantText(intl.locale, detail.createdAt),
              },
              {
                key: 'link',
                label: t('notifications.detail.link'),
                children: (
                  <span style={WRAP}>{describeLink(intl, detail.linkType, detail.linkTarget)}</span>
                ),
              },
              {
                key: 'templateKey',
                label: t('notifications.detail.templateKey'),
                children: <span style={WRAP}>{orDash(detail.templateKey)}</span>,
              },
              {
                key: 'templateParams',
                label: t('notifications.detail.templateParams'),
                children: isPlainObject(params) ? (
                  <pre
                    data-testid="template-params"
                    style={{ ...WRAP, margin: 0, maxHeight: 240, overflow: 'auto' }}
                  >
                    {JSON.stringify(params, null, 2)}
                  </pre>
                ) : (
                  <span style={WRAP}>{orDash(params)}</span>
                ),
              },
            ]}
          />
          {!hasTemplate && detail.category === 'ADMIN' ? (
            <Typography.Text type="secondary">
              {t('notifications.detail.noTemplate')}
            </Typography.Text>
          ) : null}
          <Typography.Text strong>{t('notifications.detail.languages')}</Typography.Text>
          {tags.length === 0 ? (
            <Typography.Text type="secondary">
              {detail.category === 'SYSTEM_EVENT' ? t('notifications.detail.noTexts') : DASH}
            </Typography.Text>
          ) : (
            tags.map((tag) => (
              <Flex key={tag} vertical gap={4}>
                <div>
                  <Tag data-testid={`lang-${tag}`} style={{ unicodeBidi: 'plaintext' }}>
                    {tag}
                  </Tag>
                </div>
                <div>
                  <Typography.Text type="secondary">
                    {t('notifications.detail.titleLabel')}
                  </Typography.Text>
                  <div data-testid={`title-${tag}`} dir="auto" style={{ ...WRAP, fontWeight: 600 }}>
                    {plainText(titles[tag])}
                  </div>
                </div>
                <div>
                  <Typography.Text type="secondary">
                    {t('notifications.detail.bodyLabel')}
                  </Typography.Text>
                  <div
                    data-testid={`body-${tag}`}
                    dir="auto"
                    style={{ ...WRAP, maxHeight: 280, overflow: 'auto' }}
                  >
                    {plainText(bodies[tag])}
                  </div>
                </div>
              </Flex>
            ))
          )}
        </Flex>
      ) : null}
    </Drawer>
  );
}
