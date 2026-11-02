import { useCallback } from 'react';
import { useLatestRead } from '../../hooks/useLatestRead';
import { type AppVersion, readChannelVersions } from '../../services/appVersions';

export type ChannelHint =
  | { state: 'idle' }
  | { state: 'loading' }
  /** The channel has no active version; `versions` are the others it has (they still set numbers to beat). */
  | { state: 'none'; versions: AppVersion[] }
  | { state: 'failed' }
  | { state: 'known'; versions: AppVersion[]; version: AppVersion; code: number | null };

type Read = { channel: string; versions: AppVersion[] };

/**
 * The versions of a channel, as a hint: read when the channel is known and again when it changes;
 * the answer of a read for a channel that is not the current one any more is dropped
 * (`useLatestRead`). The version that is active and the numbers a version has to beat come from
 * what the list shows now; the server decides where they are checked.
 */
export function useChannelVersions(channelCode: string | undefined): ChannelHint {
  const fetcher = useCallback(
    async (): Promise<Read> => ({
      channel: channelCode ?? '',
      versions: channelCode ? await readChannelVersions(channelCode) : [],
    }),
    [channelCode],
  );
  const { data, failure } = useLatestRead(fetcher);
  if (!channelCode) return { state: 'idle' };
  if (failure !== null) return { state: 'failed' };
  if (data === null || data.channel !== channelCode) return { state: 'loading' };
  const active = data.versions.find((v) => v.status === 'ACTIVE') ?? null;
  if (active === null) return { state: 'none', versions: data.versions };
  const code = active.versionCode;
  return {
    state: 'known',
    versions: data.versions,
    version: active,
    code: typeof code === 'number' && Number.isFinite(code) ? code : null,
  };
}
