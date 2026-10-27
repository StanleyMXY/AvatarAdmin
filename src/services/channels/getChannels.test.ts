import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { getChannels } from './getChannels';

afterEach(() => vi.unstubAllGlobals());

const row = (code: Record<string, string>) => ({
  name: 'Play',
  platform: 'ANDROID',
  distribution: 'STORE',
  packageName: 'app.example',
  enabled: true,
  createdAt: '2026-10-01T00:00:00Z',
  ...code,
});

describe('getChannels', () => {
  it('reads the channel code from `code`, the column of the contract (24.7)', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', { items: [row({ code: 'play' }), row({ code: 'direct' })] }),
      ),
    );
    const channels = await getChannels();
    expect(channels.map((c) => c.channelCode)).toEqual(['play', 'direct']);
  });

  it('still reads `channelCode` when that is what the list gives', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: [row({ channelCode: 'play' })] })));
    expect((await getChannels()).map((c) => c.channelCode)).toEqual(['play']);
  });

  it('reads a bare list and drops rows with no code or a code that is not text', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', [
          row({ code: 'play' }),
          row({ code: '' }),
          { name: 'x' },
          row({ code: 5 as never }),
        ]),
      ),
    );
    expect((await getChannels()).map((c) => c.channelCode)).toEqual(['play']);
  });
});
