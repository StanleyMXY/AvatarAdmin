import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type AppVersion,
  deleteAppVersion,
  listAppVersions,
  PLATFORMS,
  type Platform,
  setAppVersionStatus,
  VERSION_STATUSES,
  type VersionStatus,
} from '../../services/appVersions';
import { type ChannelPackage, listChannelPackages } from '../../services/channelPackages';
import { describeFailure } from '../../session/describe';
import { formatBytes } from '../../utils/format';
import { validateServerLink } from '../../utils/linkRule';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { ActivateModal } from './ActivateModal';
import { distributionOf } from './distribution';
import { PagedTable } from './PagedTable';
import { adminText, codeText, instantText, orDash } from './texts';
import { useLatestRead } from './useLatestRead';
import { useServerPage } from './useServerPage';
import { VersionModal } from './VersionModal';

type Filters = { channelCode: string; platform: string; status: string };
const NO_FILTERS: Filters = { channelCode: '', platform: '', status: '' };

const STATUS_COLOR: Record<VersionStatus, string | undefined> = {
  DRAFT: undefined,
  ACTIVE: 'green',
  ARCHIVED: 'default',
};

/** A version number as written: no thousands separator (it is an identifier), a dash when there is none. */
const numberText = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : orDash(value);

/** The cell of the store link (a STORE channel) or of the file (a DIRECT channel). */
function LinkCell({
  row,
  direct,
  locale,
  openLabel,
  summary,
}: {
  row: AppVersion;
  direct: boolean;
  locale: string;
  openLabel: string;
  summary: (values: { size: string; sha: string }) => string;
}) {
  if (direct) {
    const bytes = row.apkSizeBytes;
    const size =
      typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0
        ? formatBytes(bytes, locale)
        : DASH;
    const sha = plainText(row.apkSha256).slice(0, 8) || DASH;
    return <span dir="auto">{summary({ size, sha })}</span>;
  }
  const url = plainText(row.storeUrl);
  if (url === '') return <span>{DASH}</span>;
  // Only an https link is made a link; whatever else is in the field is shown as text.
  const safe = validateServerLink(url).ok;
  return (
    <Flex vertical gap={2} align="start">
      <EllipsisPopoverText text={url} lines={2} width={260} />
      {safe ? (
        <a href={url} target="_blank" rel="noreferrer noopener">
          {openLabel}
        </a>
      ) : null}
    </Flex>
  );
}

/**
 * 应用版本: the versions of each channel package, with the rule of the decision at the top. A draft
 * is edited, activated or deleted; the active version is taken down; an archived one has nothing.
 * What needs APPVERSION:MANAGE (new, edit, delete) and what needs APPVERSION:ACTIVATE (activate,
 * take down) is shown for the code of each.
 */
export default function AppVersionsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('APPVERSION:MANAGE');
  const canActivate = access.canAccess('APPVERSION:ACTIVATE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<AppVersion | 'new' | null>(null);
  const [activating, setActivating] = useState<AppVersion | null>(null);

  const channelRead = useLatestRead(listChannelPackages);
  const channelRows: ChannelPackage[] = channelRead.data ?? [];
  const channelByCode = useMemo(() => new Map(channelRows.map((c) => [c.code, c])), [channelRows]);

  const fetcher = useCallback(
    (query: Filters & { page: number; pageSize: number }) =>
      listAppVersions({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.channelCode ? { channelCode: query.channelCode } : {}),
        ...(query.platform ? { platform: query.platform as Platform } : {}),
        ...(query.status ? { status: query.status as VersionStatus } : {}),
      }),
    [],
  );
  const state = useServerPage<AppVersion, Filters>(fetcher, applied);

  // The backend lists the active versions first; so does the page, whatever the order it was sent in
  // (a stable sort: the rest keep the order they came in).
  const ordered = useMemo(
    () =>
      [...state.rows].sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE')),
    [state.rows],
  );

  const search = () => {
    setApplied({ ...draft });
    state.search();
  };

  const act = (change: () => Promise<unknown>, done: string) => async () => {
    try {
      await change();
      message.success(done);
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    state.reload();
  };

  const actionsOf = (row: AppVersion): RowAction[] => {
    const id = plainText(row.id);
    const actions: RowAction[] = [];
    if (row.status === 'DRAFT') {
      if (canManage) {
        actions.push({
          key: 'edit',
          label: t('appVersions.action.edit'),
          onClick: () => setEditing(row),
        });
      }
      if (canActivate) {
        actions.push({
          key: 'activate',
          label: t('appVersions.action.activate'),
          onClick: () => setActivating(row),
        });
      }
      if (canManage) {
        actions.push({
          key: 'delete',
          label: t('appVersions.action.delete'),
          confirmText: t('appVersions.deleteAsk'),
          onClick: act(() => deleteAppVersion(id), t('appVersions.deleted')),
        });
      }
    } else if (row.status === 'ACTIVE' && canActivate) {
      actions.push({
        key: 'deactivate',
        label: t('appVersions.action.deactivate'),
        confirmText: t('appVersions.deactivateAsk'),
        onClick: act(
          () => setAppVersionStatus(id, 'ARCHIVED'),
          t('appVersions.deactivated', { name: plainText(row.versionName) }),
        ),
      });
    }
    return actions;
  };

  const statusOptions = Object.fromEntries(
    VERSION_STATUSES.map((s) => [
      s,
      { label: t(`appVersions.status.${s}`), color: STATUS_COLOR[s] },
    ]),
  );

  const columns: ColumnsType<AppVersion> = [
    {
      key: 'channel',
      title: t('appVersions.col.channel'),
      render: (_, row) => {
        const code = plainText(row.channelCode);
        const channel = channelByCode.get(code);
        const name = channel ? plainText(channel.name) : '';
        return (
          <Flex vertical gap={0} align="start">
            {name !== '' ? <EllipsisPopoverText text={name} lines={2} width={200} /> : null}
            <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere', maxWidth: 200 }}>
              {code === '' ? DASH : code}
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      key: 'platform',
      title: t('appVersions.col.platform'),
      render: (_, row) => codeText(intl, 'appVersions.platform', row.platform) || DASH,
    },
    {
      key: 'versionName',
      title: t('appVersions.col.versionName'),
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>{orDash(row.versionName)}</span>
      ),
    },
    {
      key: 'versionCode',
      title: t('appVersions.col.versionCode'),
      align: 'end',
      render: (_, row) => numberText(row.versionCode),
    },
    {
      key: 'minVersionCode',
      title: t('appVersions.col.minVersionCode'),
      align: 'end',
      render: (_, row) => numberText(row.minVersionCode),
    },
    {
      key: 'status',
      title: t('appVersions.col.status'),
      render: (_, row) => <StatusTag status={plainText(row.status)} options={statusOptions} />,
    },
    {
      key: 'link',
      title: t('appVersions.col.link'),
      render: (_, row) => (
        <LinkCell
          row={row}
          direct={distributionOf(row, channelRows) === 'DIRECT'}
          locale={intl.locale}
          openLabel={t('appVersions.file.openLink')}
          summary={(values) => t('appVersions.file.summary', values)}
        />
      ),
    },
    {
      key: 'createdBy',
      title: t('appVersions.col.createdBy'),
      render: (_, row) => (
        <span style={{ overflowWrap: 'anywhere' }}>
          {adminText(row.createdByUsername, row.createdBy)}
        </span>
      ),
    },
    {
      key: 'activatedAt',
      title: t('appVersions.col.activatedAt'),
      render: (_, row) => instantText(intl.locale, row.activatedAt),
    },
    {
      key: 'actions',
      title: t('appVersions.col.actions'),
      // Stays in sight when the table is wider than its box and scrolls.
      fixed: 'right',
      render: (_, row) => {
        const actions = actionsOf(row);
        return actions.length === 0 ? DASH : <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Alert
        type="info"
        showIcon
        data-testid="appversions-rules"
        title={t('appVersions.rules.title')}
        description={
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>{t('appVersions.rules.none')}</li>
            <li>{t('appVersions.rules.optional')}</li>
            <li>{t('appVersions.rules.forced')}</li>
            <li>{t('appVersions.rules.atMinimum')}</li>
          </ul>
        }
      />
      <Flex gap={8} wrap align="start">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 220 }}
          aria-label={t('appVersions.filter.channel')}
          placeholder={t('appVersions.filter.channel')}
          value={draft.channelCode || undefined}
          options={channelRows.map((c) => ({
            value: c.code,
            label: `${plainText(c.name) || c.code} (${c.code})`,
          }))}
          onChange={(channelCode) => setDraft((d) => ({ ...d, channelCode: channelCode ?? '' }))}
        />
        <Select
          allowClear
          style={{ minWidth: 140 }}
          aria-label={t('appVersions.filter.platform')}
          placeholder={t('appVersions.filter.platform')}
          value={draft.platform || undefined}
          options={PLATFORMS.map((p) => ({ value: p, label: t(`appVersions.platform.${p}`) }))}
          onChange={(platform) => setDraft((d) => ({ ...d, platform: platform ?? '' }))}
        />
        <Select
          allowClear
          style={{ minWidth: 140 }}
          aria-label={t('appVersions.filter.status')}
          placeholder={t('appVersions.filter.status')}
          value={draft.status || undefined}
          options={VERSION_STATUSES.map((s) => ({ value: s, label: t(`appVersions.status.${s}`) }))}
          onChange={(status) => setDraft((d) => ({ ...d, status: status ?? '' }))}
        />
        <Button type="primary" onClick={search}>
          {t('appVersions.search')}
        </Button>
        {canManage ? (
          <Button onClick={() => setEditing('new')}>{t('appVersions.new')}</Button>
        ) : null}
      </Flex>
      {channelRead.failure ? (
        <Alert
          type="warning"
          showIcon
          title={t('appVersions.channelLoadFailed', { message: channelRead.failure })}
          action={
            <Button size="small" onClick={channelRead.reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      <PagedTable<AppVersion>
        state={{ ...state, rows: ordered }}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('appVersions.empty')}
      />
      {/* Mounted only while it is open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <VersionModal
          version={editing === 'new' ? null : editing}
          channels={{ rows: channelRows, failure: channelRead.failure, reload: channelRead.reload }}
          onClose={() => setEditing(null)}
          onSaved={state.reload}
        />
      ) : null}
      {activating !== null ? (
        <ActivateModal
          version={activating}
          channels={channelRows}
          rows={state.rows}
          onClose={() => setActivating(null)}
          onDone={state.reload}
        />
      ) : null}
    </Flex>
  );
}
