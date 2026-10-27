// Helpers for the tests of the mock backend: call a handler without a server.
import type { Envelope, MockReq, MockRes } from './http';
import { findAdminByUsername, type MockAdmin } from './store';

type Handler = (req: MockReq, res: MockRes) => unknown;

export const makeReq = (over: Partial<MockReq> = {}): MockReq => ({
  headers: {},
  query: {},
  params: {},
  body: undefined,
  ...over,
});

export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

// The data of an answer is whatever the endpoint returns; tests read it field by field.
// biome-ignore lint/suspicious/noExplicitAny: test helper, see above
type AnyData = any;

/** Runs a mock handler with a fake request and response and returns what it answered. */
export async function call(
  handler: Handler,
  req: Partial<MockReq> = {},
): Promise<{ status: number; body: Envelope<AnyData> }> {
  let status = 0;
  let body: unknown;
  const res: MockRes = {
    status(code) {
      status = code;
      return res;
    },
    json(value) {
      body = value;
      return undefined;
    },
  };
  await handler(makeReq(req), res);
  return { status, body: body as Envelope<AnyData> };
}

/** A preset administrator of the store; throws when there is none of that name. */
export function adminOf(username: string): MockAdmin {
  const admin = findAdminByUsername(username);
  if (!admin) throw new Error(`no administrator ${username} in the store`);
  return admin;
}
