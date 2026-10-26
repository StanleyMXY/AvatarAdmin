import type { ChannelPackage } from '../../services/channelPackages';

type VersionLike = {
  channelCode?: unknown;
  apkUploadId?: unknown;
  apkSha256?: unknown;
  storeUrl?: unknown;
};

const filled = (value: unknown) => typeof value === 'string' && value !== '';

/**
 * Whether a version belongs to a STORE or a DIRECT channel. The channel package says it; when the
 * channel list has no such channel (it could not be read, or the channel is gone) the version
 * itself says it: a file means DIRECT, a link means STORE. When nothing says it, STORE: it is the
 * one that asks for more.
 */
export function distributionOf(
  version: VersionLike,
  channels: readonly ChannelPackage[] | null | undefined,
): 'STORE' | 'DIRECT' {
  const channel = channels?.find((c) => c.code === version.channelCode);
  if (channel?.distribution === 'STORE' || channel?.distribution === 'DIRECT') {
    return channel.distribution;
  }
  if (filled(version.apkUploadId) || filled(version.apkSha256)) return 'DIRECT';
  return 'STORE';
}
