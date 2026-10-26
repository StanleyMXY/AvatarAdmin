import { useIntl } from '@umijs/max';
import { Alert, Descriptions, Drawer, Flex, Spin, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { StatusTag } from '../../components/StatusTag';
import { getFeedback, type SupportFeedback } from '../../services/support';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { categoryText, statusOptions } from './feedbackTexts';

/** Any text, any script, any length: broken anywhere, shown in its own direction, never wider than the drawer. */
const WRAP: CSSProperties = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
};

const CONTEXT_FIELDS = ['appVersion', 'osVersion', 'deviceModel', 'locale'] as const;

/** The detail of one feedback: the whole message and the context the app sent with it. */
export function FeedbackDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [feedback, setFeedback] = useState<SupportFeedback | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) return;
    let live = true;
    setFeedback(null);
    setFailure(null);
    getFeedback(id)
      .then((row) => {
        if (live) setFeedback(row);
      })
      .catch((error) => {
        if (live) setFailure(describeFailure(intl, error).text);
      });
    return () => {
      live = false;
    };
  }, [id, intl]);

  const context = feedback?.context ?? null;
  const errors = Array.isArray(context?.recentErrors) ? context.recentErrors : [];

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      size="large"
      title={t('support.drawerTitle', { id: id ?? '' })}
      destroyOnHidden
    >
      {failure ? (
        <Alert type="error" showIcon title={t('pages.common.loadFailed', { message: failure })} />
      ) : null}
      {!feedback && !failure ? <Spin /> : null}
      {feedback ? (
        <Flex vertical gap={16}>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'category',
                label: t('support.col.category'),
                children: categoryText(intl, feedback.category),
              },
              {
                key: 'status',
                label: t('support.col.status'),
                children: (
                  <StatusTag status={feedback.forwardStatus} options={statusOptions(intl)} />
                ),
              },
              { key: 'account', label: t('support.col.account'), children: feedback.accountId },
              {
                key: 'ref',
                label: t('support.col.forwardRef'),
                children: <EllipsisPopoverText text={feedback.forwardRef} width={320} />,
              },
              { key: 'attempts', label: t('support.col.attempts'), children: feedback.attempts },
              {
                key: 'next',
                label: t('support.field.nextAttemptAt'),
                children: feedback.nextAttemptAt
                  ? formatInstant(feedback.nextAttemptAt, intl.locale)
                  : DASH,
              },
              {
                key: 'error',
                label: t('support.field.lastError'),
                children: <EllipsisPopoverText text={feedback.lastError} width={320} />,
              },
              {
                key: 'created',
                label: t('support.col.createdAt'),
                children: formatInstant(feedback.createdAt, intl.locale),
              },
            ]}
          />
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('support.field.message')}</Typography.Text>
            <div
              data-testid="feedback-message"
              dir="auto"
              style={{ ...WRAP, maxHeight: 360, overflow: 'auto' }}
            >
              {feedback.message}
            </div>
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('support.context')}</Typography.Text>
            {context === null ? (
              <Typography.Text type="secondary">{t('support.context.none')}</Typography.Text>
            ) : (
              <Descriptions
                column={1}
                size="small"
                items={[
                  ...CONTEXT_FIELDS.map((field) => ({
                    key: field,
                    label: t(`support.context.${field}`),
                    children: <span style={WRAP}>{context[field] || DASH}</span>,
                  })),
                  {
                    key: 'recentErrors',
                    label: t('support.context.recentErrors'),
                    children:
                      errors.length === 0 ? (
                        DASH
                      ) : (
                        <ol style={{ margin: 0, paddingInlineStart: 20 }}>
                          {errors.map((line, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: the lines are text that can repeat
                            <li key={i} dir="auto" style={WRAP}>
                              {line}
                            </li>
                          ))}
                        </ol>
                      ),
                  },
                ]}
              />
            )}
          </Flex>
        </Flex>
      ) : null}
    </Drawer>
  );
}
