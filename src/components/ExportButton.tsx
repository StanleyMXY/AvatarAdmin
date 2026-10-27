import { useAccess, useIntl } from '@umijs/max';
import { App, Button } from 'antd';
import { useState } from 'react';
import type { PermissionCode } from '../access/permissionCodes';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { downloadFile } from '../request/download';
import { describeFailure } from '../session/describe';
import { formatBytes } from '../utils/format';

type Access = { canAccess: (code?: string) => boolean };

type Props = {
  /** The report name in `/stats/export/{name}`. */
  name: string;
  params: Record<string, unknown>;
  /** The permission to see the page the export belongs to; it is needed together with `STATS:EXPORT`. */
  viewCode: PermissionCode;
  /** Another export address (the user list and others have their own). */
  url?: string;
  /** Replaces the default `['STATS:EXPORT', viewCode]`: every one of these is needed. */
  requiredCodes?: PermissionCode[];
};

/**
 * The export button. It is not drawn for an administrator who lacks a needed permission. The file
 * is requested with the token in a header; only an answer that really is the spreadsheet is saved,
 * and a refusal of the backend (rate limit, too many rows, no permission) is shown, never saved.
 */
export function ExportButton({ name, params, viewCode, url, requiredCodes }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [received, setReceived] = useState<number | null>(null);

  const { run, pending } = useSingleFlight(async () => {
    setReceived(0);
    try {
      const { filename } = await downloadFile({
        url: url ?? `/stats/export/${encodeURIComponent(name)}`,
        params,
        fallbackName: `${name}.xlsx`,
        onProgress: setReceived,
      });
      message.success(intl.formatMessage({ id: 'pages.export.saved' }, { name: filename }));
    } catch (error) {
      const { error: failure, text } = describeFailure(intl, error);
      // The backend refuses an export with too many rows as 400 INVALID_REQUEST; its message is not
      // shown (codes are translated here), so the text says what to try.
      message.error(
        failure.code === 'INVALID_REQUEST'
          ? `${text} ${intl.formatMessage({ id: 'pages.export.narrowRange' })}`
          : text,
      );
    } finally {
      setReceived(null);
    }
  });

  const needed = requiredCodes ?? ['STATS:EXPORT', viewCode];
  if (!needed.every((code) => access.canAccess(code))) return null;

  return (
    <Button onClick={() => void run()} loading={pending} disabled={pending}>
      {received === null || received === 0
        ? intl.formatMessage({ id: 'pages.export.button' })
        : intl.formatMessage(
            { id: 'pages.export.received' },
            { bytes: formatBytes(received, intl.locale) },
          )}
    </Button>
  );
}
