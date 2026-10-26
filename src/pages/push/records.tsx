import { QuestionCircleOutlined } from '@ant-design/icons';
import { Link, useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Flex, Spin, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import {
  getRecord,
  listRecords,
  type Page,
  type PushDelivery,
  type PushRecord,
  type PushRecordDetail,
} from '../../services/push';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { codeText, instantText } from './texts';

/** An account id: any text, cut to two lines; a link to the user when the administrator may see users. */
function AccountCell({ accountId }: { accountId: unknown }) {
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const text = plainText(accountId);
  if (text === '') return <span>{DASH}</span>;
  if (typeof accountId === 'string' && access.canAccess('USER:VIEW')) {
    return (
      <Link
        to={`/users/${encodeURIComponent(accountId)}`}
        title={accountId}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: 260,
          overflowWrap: 'anywhere',
          wordBreak: 'break-all',
        }}
      >
        {accountId}
      </Link>
    );
  }
  return <EllipsisPopoverText text={text} lines={2} width={260} />;
}

/** The result for each token of one record, read when the row is opened. */
function Deliveries({ id }: { id: string }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [detail, setDetail] = useState<PushRecordDetail | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setDetail(null);
    setFailure(null);
    try {
      const record = await getRecord(id);
      if (mine === counter.current) setDetail(record);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intl, error).text);
    }
  }, [id, intl]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('push.records.loadFailed', { message: failure })}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }
  if (detail === null) return <Spin />;
  if (detail.deliveries.length === 0) {
    return <Typography.Text type="secondary">{t('push.records.noDeliveries')}</Typography.Text>;
  }
  const columns: ColumnsType<PushDelivery & { __key: string }> = [
    {
      title: t('push.records.col.token'),
      dataIndex: 'pushTokenId',
      render: (value: unknown) => (
        <EllipsisPopoverText text={plainText(value)} lines={1} width={220} />
      ),
    },
    {
      title: t('push.records.col.result'),
      dataIndex: 'result',
      render: (value: unknown) => codeText(intl, 'push.result', value) || DASH,
    },
    {
      title: t('push.records.col.sentAt'),
      dataIndex: 'sentAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
  ];
  return (
    <Flex vertical gap={8} data-testid="deliveries">
      <Typography.Text strong>{t('push.records.deliveries')}</Typography.Text>
      <Table<PushDelivery & { __key: string }>
        size="small"
        rowKey="__key"
        columns={columns}
        dataSource={detail.deliveries.map((d, i) => ({ ...d, __key: `${plainText(d.id)}|${i}` }))}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Flex>
  );
}

/** 发送记录 (`PUSH:VIEW`): each push to an account; a row opens to the result for each token. */
export default function RecordsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [paging, setPaging] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState<Page<PushRecord> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setLoading(true);
    try {
      const page = await listRecords(paging);
      if (mine !== counter.current) return;
      setData(page);
      setFailure(null);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intl, error).text);
    } finally {
      if (mine === counter.current) setLoading(false);
    }
  }, [paging, intl]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<PushRecord & { __key: string }> = [
    {
      title: t('push.records.col.account'),
      dataIndex: 'accountId',
      render: (value: unknown) => <AccountCell accountId={value} />,
    },
    {
      title: t('push.records.col.type'),
      dataIndex: 'pushType',
      render: (value: unknown) => codeText(intl, 'push.type', value) || plainText(value) || DASH,
    },
    {
      title: t('push.records.col.reason'),
      dataIndex: 'triggerReason',
      render: (value: unknown) => codeText(intl, 'push.reason', value) || plainText(value) || DASH,
    },
    {
      title: (
        <span>
          {t('push.records.col.localDate')}
          <Tooltip title={t('push.records.localDate.tip')}>
            <QuestionCircleOutlined
              data-testid="tip-localDate"
              aria-hidden={false}
              style={{ marginInlineStart: 4 }}
            />
          </Tooltip>
        </span>
      ),
      dataIndex: 'localDate',
      render: (value: unknown) => plainText(value) || DASH,
    },
    {
      title: t('push.records.col.createdAt'),
      dataIndex: 'createdAt',
      render: (value: unknown) => instantText(intl.locale, value),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('push.records.note')}
      </Typography.Paragraph>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      <Table<PushRecord & { __key: string }>
        size="middle"
        rowKey="__key"
        loading={loading}
        columns={columns}
        dataSource={(data?.items ?? []).map((r, i) => ({ ...r, __key: `${plainText(r.id)}|${i}` }))}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('push.records.empty') }}
        expandable={{ expandedRowRender: (row) => <Deliveries id={plainText(row.id)} /> }}
        pagination={{
          current: paging.page,
          pageSize: paging.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (page, pageSize) => setPaging({ page, pageSize }),
        }}
      />
    </Flex>
  );
}
