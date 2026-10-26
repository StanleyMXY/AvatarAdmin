import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { channelsState, type MockChannel } from './_core/channelsData';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';

// The channel packages (contract 24.7): any signed-in administrator reads the list, CHANNEL:MANAGE
// creates and changes. The code, the platform and the distribution cannot be changed after the
// channel is made, and there is no delete. Each row has the code twice, as `code` (the column of the
// contract) and as `channelCode` (what the first reader of this list, the statistics filters, read).

const CODE = /^[a-z0-9_-]{2,32}$/;
const PLATFORMS = ['ANDROID', 'IOS'];
const DISTRIBUTIONS = ['STORE', 'DIRECT'];

type Detail = { ref: string; reason: string };
const refuse = (details: Detail[]): never => {
  throw invalidRequest(`invalid: ${details.map((d) => d.ref).join(', ')}`, details);
};

const view = (channel: MockChannel) => ({ ...structuredClone(channel), channelCode: channel.code });

const nameProblem = (value: unknown): Detail | null => {
  // The contract gives no length for the name.
  const name = typeof value === 'string' ? trimSpec(value) : '';
  return name === '' ? { ref: 'name', reason: 'EMPTY_NOT_ALLOWED' } : null;
};

/** A package name that is blank is none. */
const packageOf = (value: unknown): string | null => {
  const text = typeof value === 'string' ? trimSpec(value) : '';
  return text === '' ? null : text;
};

export default {
  // Any signed-in administrator may read the list (contract 24.7).
  'GET /api/admin/channels': guard(null, () =>
    ok({ items: [...channelsState.channels.values()].map(view) }),
  ),

  'POST /api/admin/channels': guard('CHANNEL:MANAGE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const code = typeof body.code === 'string' ? body.code : '';
    // `unknown` is the reserved value of the statistics for "no channel"
    if (!CODE.test(code) || code === 'unknown')
      details.push({ ref: 'code', reason: 'INVALID_PATTERN' });
    const nameDetail = nameProblem(body.name);
    if (nameDetail) details.push(nameDetail);
    if (!PLATFORMS.includes(String(body.platform)))
      details.push({ ref: 'platform', reason: 'OUT_OF_RANGE' });
    if (!DISTRIBUTIONS.includes(String(body.distribution))) {
      details.push({ ref: 'distribution', reason: 'OUT_OF_RANGE' });
    } else if (body.distribution === 'DIRECT' && body.platform === 'IOS') {
      // a direct download is an Android file
      details.push({ ref: 'distribution', reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) refuse(details);
    if (channelsState.channels.has(code)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The channel code exists already', {
        field: 'code',
      });
    }
    const now = new Date().toISOString();
    const channel: MockChannel = {
      code,
      name: trimSpec(body.name as string),
      platform: body.platform as MockChannel['platform'],
      distribution: body.distribution as MockChannel['distribution'],
      packageName: packageOf(body.packageName),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    channelsState.channels.set(code, channel);
    return ok(view(channel));
  }),

  'PUT /api/admin/channels/:code': guard('CHANNEL:MANAGE', (req) => {
    const channel = channelsState.channels.get(req.params.code);
    if (!channel) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'The channel is not there');
    const body = bodyOf(req);
    const details: Detail[] = [];
    // The code, the platform and the distribution are the key of the channel: saying them again is
    // fine, saying another one is not.
    for (const field of ['code', 'platform', 'distribution'] as const) {
      if (field in body && body[field] !== channel[field]) {
        details.push({ ref: field, reason: 'OUT_OF_RANGE' });
      }
    }
    if ('name' in body) {
      const detail = nameProblem(body.name);
      if (detail) details.push(detail);
    }
    if ('enabled' in body && typeof body.enabled !== 'boolean') {
      details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
    }
    if (details.length > 0) refuse(details);
    if ('name' in body) channel.name = trimSpec(body.name as string);
    if ('packageName' in body) channel.packageName = packageOf(body.packageName);
    if ('enabled' in body) channel.enabled = body.enabled as boolean;
    channel.updatedAt = new Date().toISOString();
    return ok(view(channel));
  }),
};
