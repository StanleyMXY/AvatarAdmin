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
import { type FailureLines, useFailure, useFailureView } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
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
import { ASSET_IDS_MAX, cleanAssetIds, isUuid } from './assetIds';
import { EvidenceViewer } from './EvidenceViewer';
import { statusOptions } from './statusOptions';

export const NOTE_MAX = 1000;

/** A control character (C0, DEL, C1), a new line and a tab included: the backend refuses a note that has one. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: this is the check for them
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;

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
  const { text: loadFailure, fail: failLoad, clear: clearLoad } = useFailure();
  const [status, setStatus] = useState<SettableComplaintStatus | undefined>();
  const [note, setNote] = useState('');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  // More IDs were offered than a removal takes: the rest were not kept, and the text says so.
  const [idsCut, setIdsCut] = useState(false);
  // The failure of a removal has lines under it: the IDs the backend did not find.
  const {
    view: removeFailure,
    show: showRemoveFailure,
    clear: clearRemoveFailure,
  } = useFailureView<FailureLines>();
  const {
    text: problem,
    fail: failWrite,
    failWith: failWriteWith,
    clear: clearProblem,
  } = useFailure();
  const options = statusOptions(intl);

  // Only the newest read is shown: an answer for a complaint that was closed or replaced is dropped.
  const begin = useLatestCall();
  const load = useCallback(async () => {
    const isCurrent = begin();
    if (id === null) return;
    clearLoad();
    try {
      const read = await getComplaint(id);
      if (isCurrent()) setDetail(read);
    } catch (error) {
      if (isCurrent()) failLoad(error);
    }
  }, [id, begin, failLoad, clearLoad]);

  // A different complaint starts from an empty drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `id` is the trigger, nothing else is read
  useEffect(() => {
    setDetail(null);
    setStatus(undefined);
    setNote('');
    setAssetIds([]);
    setIdsCut(false);
    clearProblem();
    clearRemoveFailure();
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const closed = detail ? CLOSED_COMPLAINT_STATUSES.includes(detail.status) : false;
  const when = (iso: string | null | undefined) => (iso ? formatInstant(iso, intl.locale) : DASH);

  /** Runs a write; whatever the answer, the complaint and the list are read again, since a refusal can mean the state moved. */
  const write = async (
    call: () => Promise<unknown>,
    done: string,
    onFailure: (error: unknown) => void = failWrite,
  ) => {
    clearProblem();
    clearRemoveFailure();
    try {
      await call();
      message.success(t(done));
      setStatus(undefined);
      setNote('');
      setAssetIds([]);
      setIdsCut(false);
    } catch (error) {
      onFailure(error);
    }
    await load();
    onChanged();
  };

  const changeStatus = useSingleFlight(async () => {
    if (!detail || !status || status === detail.status) return;
    if (countCodePoints(trimSpec(note)) > NOTE_MAX) {
      failWriteWith((words) =>
        words.formatMessage({ id: 'complaints.note.length' }, { max: NOTE_MAX }),
      );
      return;
    }
    // A new line is a control character too; the backend refuses a note that has one (400).
    if (CONTROL_CHARACTER.test(trimSpec(note))) {
      failWriteWith((words) => words.formatMessage({ id: 'complaints.note.control' }));
      return;
    }
    await write(
      () => setComplaintStatus(detail.id, status, trimSpec(note)),
      'complaints.status.saved',
    );
  });

  const removeAvatars = async () => {
    if (!detail) return;
    if (!removable) return;
    await write(
      () => removeComplaintAvatars(detail.id, assetIds),
      'complaints.remove.done',
      (error) =>
        showRemoveFailure((words) => {
          const described = describeFailure(words, error);
          // An ID the backend did not find comes with its own line: the ID, then the reason.
          return {
            text: described.text,
            more: described.fields.map((f) =>
              f.ref === 'assetIds' ? f.text : `${f.ref}: ${f.text}`,
            ),
          };
        }),
    );
  };

  /** What goes into the field of IDs: cleaned, each once, at most the 20 a removal takes. */
  const takeIds = (values: string[]) => {
    const clean = cleanAssetIds(values);
    setIdsCut(clean.length > ASSET_IDS_MAX);
    setAssetIds(clean.slice(0, ASSET_IDS_MAX));
  };
  const badId = assetIds.find((value) => !isUuid(value));
  const removable = assetIds.length > 0 && badId === undefined;

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
          {removeFailure ? (
            <Alert
              type="error"
              showIcon
              style={{ overflowWrap: 'anywhere' }}
              title={removeFailure.text}
              description={
                removeFailure.more.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                    {removeFailure.more.map((line, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines of one failure, never reordered
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          ) : null}
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
                      // The state the complaint has is shown but cannot be chosen: setting it again is a 409.
                      options={SETTABLE_COMPLAINT_STATUSES.map((value) => ({
                        value,
                        label: options[value]?.label ?? value,
                        disabled: value === detail.status,
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
                    disabled={!status || status === detail.status || changeStatus.pending}
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
                    maxCount={ASSET_IDS_MAX}
                    value={assetIds}
                    onChange={takeIds}
                  />
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {t('complaints.remove.count', { n: assetIds.length, max: ASSET_IDS_MAX })}
                    {idsCut ? ` ${t('complaints.remove.cut', { max: ASSET_IDS_MAX })}` : ''}
                  </Typography.Paragraph>
                  {badId !== undefined ? (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 8, overflowWrap: 'anywhere' }}
                      title={t('complaints.remove.notUuid', { id: badId })}
                    />
                  ) : null}
                  <DangerConfirmButton
                    confirmText={t('complaints.remove.confirm')}
                    disabled={!removable}
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
