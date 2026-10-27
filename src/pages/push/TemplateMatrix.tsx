import { useIntl } from '@umijs/max';
import { Card, Table, Tag, Typography } from 'antd';
import { plainText } from '../../utils/plainText';
import type { CoverageRow } from './coverage';
import { codeText } from './texts';

/**
 * The completeness matrix of spec 5.11: a row for each recall reason, a column for each supported
 * language. A cell with a template says whether it is on; a cell without one is red.
 */
export function TemplateMatrix({ rows, locales }: { rows: CoverageRow[]; locales: string[] }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Card size="small" title={t('push.templates.matrix.title')} data-testid="coverage-matrix">
      <Typography.Paragraph type="secondary">
        {t('push.templates.matrix.note')}
      </Typography.Paragraph>
      <Table<CoverageRow>
        size="small"
        rowKey="reason"
        pagination={false}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('push.templates.matrix.reason'),
            dataIndex: 'reason',
            render: (reason: string) => codeText(intl, 'push.reason', reason),
          },
          ...locales.map((locale) => ({
            title: plainText(locale),
            key: locale,
            render: (_: unknown, row: CoverageRow) => {
              const found = row.cells.find((c) => c.locale === locale)?.template ?? null;
              const state = found === null ? 'missing' : found.enabled ? 'on' : 'off';
              return (
                <span data-testid={`cell-${row.reason}-${locale}`} data-state={state}>
                  {state === 'missing' ? (
                    <Tag color="error">{t('push.templates.matrix.missing')}</Tag>
                  ) : state === 'on' ? (
                    <Tag color="success">{t('push.templates.matrix.on')}</Tag>
                  ) : (
                    <Tag>{t('push.templates.matrix.off')}</Tag>
                  )}
                </span>
              );
            },
          })),
        ]}
      />
    </Card>
  );
}
