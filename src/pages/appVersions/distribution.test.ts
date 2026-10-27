import { describe, expect, it } from 'vitest';
import type { ChannelPackage } from '../../services/channelPackages';
import { distributionOf } from './distribution';

const channel = (code: string, distribution: string): ChannelPackage => ({
  code,
  name: code,
  platform: 'ANDROID',
  distribution,
  packageName: null,
  enabled: true,
  createdAt: null,
  updatedAt: null,
});

describe('distributionOf: the kind of the channel of a version', () => {
  it('is what the channel package says', () => {
    const channels = [channel('play', 'STORE'), channel('direct', 'DIRECT')];
    expect(distributionOf({ channelCode: 'play' }, channels)).toBe('STORE');
    expect(distributionOf({ channelCode: 'direct' }, channels)).toBe('DIRECT');
    // the channel wins over what the version looks like
    expect(distributionOf({ channelCode: 'play', apkUploadId: 'up-1' }, channels)).toBe('STORE');
  });

  it('is read from the version when the channel is not in the list', () => {
    expect(distributionOf({ channelCode: 'x', apkUploadId: 'up-1' }, [])).toBe('DIRECT');
    expect(distributionOf({ channelCode: 'x', apkSha256: 'ab'.repeat(32) }, null)).toBe('DIRECT');
    expect(distributionOf({ channelCode: 'x', storeUrl: 'https://example.com' }, undefined)).toBe(
      'STORE',
    );
  });

  it('is STORE, the kind that asks for more, when nothing says it', () => {
    expect(distributionOf({}, [])).toBe('STORE');
    expect(distributionOf({ channelCode: 'x', apkUploadId: '' }, [])).toBe('STORE');
    expect(distributionOf({ channelCode: 'x' }, [channel('x', 'SOMETHING')])).toBe('STORE');
    expect(distributionOf({ channelCode: 'x', apkUploadId: 5 }, [channel('x', '')])).toBe('STORE');
  });
});
