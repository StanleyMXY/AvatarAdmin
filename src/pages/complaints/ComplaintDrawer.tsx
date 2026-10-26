import { useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { StatusTag } from '../../components/StatusTag';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  CLOSED_COMPLAINT_STATUSES,
  type ComplaintDetail,
  type ComplaintEvent,
  getComplaint,
  removeComplaintAvatars,
  SETTABLE_COMPLAINT_STATUSES,
  type SettableComplaintStatus,
  setComplaintStatus,
} from '../../services/complaints';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { EvidenceViewer } from './EvidenceViewer';
import { statusOptions } from './statusOptions';

export const NOTE_MAX = 1000;

type Props = {
  /** The complaint to show; none closes the drawer. */
  id: string | null;
  onClose: () => void;
  /** The list is read again after a change. */
  onChanged: () => void;
};

/** The administrator's name, the id's first 8 characters when the administrator no longer exists, or a dash. */
export const adminLabel = (username: string | null | undefined, id: string | null | undefined) =>
  username ?? (id ? id.slice(0, 8) : DASH);

/** The ids typed or pasted for a removal: trimmed with the contract set, empty ones dropped, once each. */
export const cleanAssetIds = (values: readonly string[]): string[] => [
  ...new Set(values.map((v) => trimSpec(v)).filter((v) => v !== '')),
];

/**
 * One likeness complaint: the description, the evidence (read file by file), the history of status
 * changes, and, for an administrator who may manage complaints and while the complaint is open, the
 * status change and the removal of the avatars it is about.
 */
export function ComplaintDrawer({ id, onClose, onChanged }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('COMPLAINT:MANAGE');
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<SettableComplaintStatus | undefined>();
  const [note, setNote] = useState('');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const options = statusOptions(intl);

  const load = useCallback(async () => {
    if (id === null) return;
    setLoadFailure(null);
    try {
      setDetail(await getComplaint(id));
    } catch (error) {
      setLoadFailure(describeFailure(intl, error).text);
    }
  }, [id, intl]);

  // A different complaint starts from an empty drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `id` is the trigger, nothing else is read
  useEffect(() => {
    setDetail(null);
    setStatus(undefined);
    setNote('');
    setAssetIds([]);
    setProblem(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const closed = detail ? CLOSED_COMPLAINT_STATUSES.includes(detail.status) : false;
  const when = (iso: string | null | undefined) => (iso ? formatInstant(iso, intl.locale) : DASH);

  /** Runs a write; whatever the answer, the complaint and the list are read again, since a refusal can mean the state moved. */
  const write = async (call: () => Promise<unknown>, done: string) => {
    setProblem(null);
    try {
      await call();
      message.success(t(done));
      setStatus(undefined);
      setNote('');
      setAssetIds([]);
    } catch (error) {
      setProblem(describeFailure(intl, error).text);
    }
    await load();
    onChanged();
  };

  const changeStatus = useSingleFlight(async () => {
    if (!detail || !status) return;
    if (countCodePoints(trimSpec(note)) > NOTE_MAX) {
      setProblem(t('complaints.note.length', { max: NOTE_MAX }));
      return;
    }
    await write(
      () => setComplaintStatus(detail.id, status, trimSpec(note)),
      'complaints.status.saved',
    );
  });

  const removeAvatars = async () => {
    if (!detail) return;
    await write(
      () => removeComplaintAvatars(detail.id, cleanAssetIds(assetIds)),
      'complaints.remove.done',
    );
  };

  const eventColumns = [
    {
      title: t('complaints.event.time'),
      dataIndex: 'createdAt',
      render: (_: unknown, row: ComplaintEvent) => when(row.createdAt),
    },
    {
      title: t('complaints.event.change'),
      dataIndex: 'toStatus',
      render: (_: unknown, row: ComplaintEvent) => (
        <span>
          {row.fromStatus ? (options[row.fromStatus]?.label ?? row.fromStatus) : DASH}
          {' → '}
          {options[row.toStatus]?.label ?? row.toStatus}
        </span>
      ),
    },
    {
      title: t('complaints.event.note'),
      dataIndex: 'note',
      render: (_: unknown, row: ComplaintEvent) => (
        <EllipsisPopoverText text={row.note} lines={2} width={200} />
      ),
    },
    {
      title: t('complaints.event.admin'),
      dataIndex: 'adminUsername',
      render: (_: unknown, row: ComplaintEvent) => adminLabel(row.adminUsername, row.adminId),
    },
  ];

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      size={720}
      title={t('complaints.detail.title')}
      destroyOnHidden
    >
      {loadFailure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: loadFailure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : detail === null ? (
        <Spin />
      ) : (
        <Flex vertical gap={16}>
          {problem ? <Alert type="error" showIcon title={problem} /> : null}
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('complaints.col.id')}>{detail.id}</Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.contactEmail')}>
              <EllipsisPopoverText text={detail.contactEmail} lines={1} width={360} />
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.status')}>
              <StatusTag status={detail.status} options={options} />
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.receivedAt')}>
              {when(detail.receivedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.dueAt')}>
              {when(detail.dueAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.resolvedAt')}>
              {when(detail.resolvedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.handledBy')}>
              {adminLabel(detail.handledByUsername, detail.handledBy)}
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.description')}>
              <div
                dir="auto"
                data-testid="complaint-description"
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  maxHeight: 240,
                  overflow: 'auto',
                }}
              >
                {detail.description}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label={t('complaints.col.relatedAvatars')}>
              {detail.relatedAvatarAssetIds.length === 0 ? (
                DASH
              ) : (
                <Flex gap={4} wrap>
                  {detail.relatedAvatarAssetIds.map((assetId) => (
                    <Tag key={assetId} style={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
                      {assetId}
                    </Tag>
                  ))}
                </Flex>
              )}
            </Descriptions.Item>
          </Descriptions>

          <section>
            <Typography.Title level={5}>{t('complaints.evidence.title')}</Typography.Title>
            <EvidenceViewer complaintId={detail.id} count={detail.evidenceCount} />
          </section>

          <section>
            <Typography.Title level={5}>{t('complaints.event.title')}</Typography.Title>
            <Table<ComplaintEvent>
              size="small"
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={detail.events}
              columns={eventColumns}
              locale={{ emptyText: t('complaints.event.empty') }}
            />
          </section>

          {canManage && !closed ? (
            <section>
              <Typography.Title level={5}>{t('complaints.manage.title')}</Typography.Title>
              <Flex vertical gap={16}>
                <Form
                  layout="vertical"
                  requiredMark={false}
                  onFinish={() => void changeStatus.run().catch(() => {})}
                >
                  <Form.Item label={t('complaints.status.newStatus')}>
                    <Select
                      aria-label={t('complaints.status.newStatus')}
                      value={status}
                      onChange={setStatus}
                      options={SETTABLE_COMPLAINT_STATUSES.map((value) => ({
                        value,
                        label: options[value]?.label ?? value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('complaints.status.note')}
                    extra={t('complaints.status.noteHint', { max: NOTE_MAX })}
                  >
                    <Input.TextArea
                      aria-label={t('complaints.status.note')}
                      rows={2}
                      dir="auto"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={!status || changeStatus.pending}
                    loading={changeStatus.pending}
                  >
                    {t('complaints.status.submit')}
                  </Button>
                </Form>

                <div>
                  <Typography.Paragraph>{t('complaints.remove.intro')}</Typography.Paragraph>
                  <Select
                    mode="tags"
                    style={{ width: '100%', marginBottom: 8 }}
                    aria-label={t('complaints.remove.ids')}
                    placeholder={t('complaints.remove.placeholder')}
                    tokenSeparators={[',', ' ', '\n']}
                    open={false}
                    value={assetIds}
                    onChange={setAssetIds}
                  />
                  <DangerConfirmButton
                    confirmText={t('complaints.remove.confirm')}
                    disabled={cleanAssetIds(assetIds).length === 0}
                    onConfirm={removeAvatars}
                  >
                    {t('complaints.remove.button')}
                  </DangerConfirmButton>
                </div>
              </Flex>
            </section>
          ) : null}
        </Flex>
      )}
    </Drawer>
  );
}
