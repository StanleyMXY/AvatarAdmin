import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { channelsState, type MockChannel } from './_core/channelsData';
import { bodyOf, MockHttpError, ok } from './_core/http';

// The channel packages (contract 24.7): any signed-in administrator reads the list, CHANNEL:MANAGE
// creates and changes. The code, the platform and the distribution cannot be changed after the
// channel is made, and there is no delete. A row has the code as `code`, the column of the contract.

const CODE = /^[a-z0-9_-]{2,32}$/;
const PACKAGE_NAME = /^[A-Za-z0-9._-]+$/;
const PLATFORMS = ['ANDROID', 'IOS'];
const DISTRIBUTIONS = ['STORE', 'DIRECT'];
// Answers 90: the name has 1 to 64 code points after the ends are cut, the package name at most 255 characters.
const NAME_MAX = 64;
const PACKAGE_MAX = 255;

/**
 * Every 400 of the channels is INVALID_REQUEST with an English message and no details: the backend
 * gives no `ref` and no reason code for them (answers 90). The first field that is wrong decides.
 */
const refuse = (message: string): never => {
  throw new MockHttpError(400, 'INVALID_REQUEST', message);
};

const view = (channel: MockChannel) => structuredClone(channel);

const codePoints = (text: string): number => [...text].length;

/** The name, cut at the ends; a name that is blank or longer than 64 code points is refused. */
function checkedName(value: unknown): string {
  const name = typeof value === 'string' ? trimSpec(value) : '';
  if (name === '') return refuse('name is required');
  if (codePoints(name) > NAME_MAX) return refuse(`name is longer than ${NAME_MAX} characters`);
  return name;
}

/** The package name: none for an empty or a missing one; at most 255 characters of A-Z a-z 0-9 . _ - */
function checkedPackage(value: unknown): string | null {
  const text = typeof value === 'string' ? trimSpec(value) : '';
  if (text === '') return null;
  if (text.length > PACKAGE_MAX)
    return refuse(`packageName is longer than ${PACKAGE_MAX} characters`);
  if (!PACKAGE_NAME.test(text)) return refuse('packageName has a character that is not allowed');
  return text;
}

export default {
  // Any signed-in administrator may read the list (contract 24.7).
  'GET /api/admin/channels': guard(null, () =>
    ok({ items: [...channelsState.channels.values()].map(view) }),
  ),

  'POST /api/admin/channels': guard('CHANNEL:MANAGE', (req) => {
    const body = bodyOf(req);
    // The order of the backend: code, name, platform, distribution, DIRECT with iOS, package name.
    const code = typeof body.code === 'string' ? body.code : '';
    // `unknown` is the reserved value of the statistics for "no channel"
    if (!CODE.test(code) || code === 'unknown') refuse('code is not valid');
    const name = checkedName(body.name);
    if (!PLATFORMS.includes(String(body.platform))) refuse('platform must be ANDROID or IOS');
    if (!DISTRIBUTIONS.includes(String(body.distribution))) {
      refuse('distribution must be STORE or DIRECT');
    }
    // a direct download is an Android file
    if (body.distribution === 'DIRECT' && body.platform === 'IOS') {
      refuse('a DIRECT channel must be ANDROID');
    }
    const packageName = checkedPackage(body.packageName);
    if (channelsState.channels.has(code)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The channel code exists already', {
        field: 'code',
      });
    }
    const now = new Date().toISOString();
    const channel: MockChannel = {
      code,
      name,
      platform: body.platform as MockChannel['platform'],
      distribution: body.distribution as MockChannel['distribution'],
      packageName,
      // Not sent is on; only an explicit false switches it off (answers 89).
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    channelsState.channels.set(code, channel);
    return ok(view(channel));
  }),

  // Answers 89: only the fields that are named change. null is "not named" (a name, a package name,
  // enabled), an empty package name clears it, a blank name is refused.
  'PUT /api/admin/channels/:code': guard('CHANNEL:MANAGE', (req) => {
    const channel = channelsState.channels.get(req.params.code);
    if (!channel) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'The channel is not there');
    const body = bodyOf(req);
    // The code, the platform and the distribution are the key of the channel: saying them again is
    // fine, saying another one is not.
    for (const field of ['code', 'platform', 'distribution'] as const) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== channel[field]) {
        refuse(`${field} cannot be changed`);
      }
    }
    const name = body.name === undefined || body.name === null ? null : checkedName(body.name);
    const named = body.packageName !== undefined && body.packageName !== null;
    const packageName = named ? checkedPackage(body.packageName) : null;
    if (body.enabled !== undefined && body.enabled !== null && typeof body.enabled !== 'boolean') {
      refuse('enabled must be true or false');
    }
    if (name !== null) channel.name = name;
    if (named) channel.packageName = packageName;
    if (typeof body.enabled === 'boolean') channel.enabled = body.enabled;
    channel.updatedAt = new Date().toISOString();
    return ok(view(channel));
  }),
};
