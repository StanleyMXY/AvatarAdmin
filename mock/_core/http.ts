// The mock backend answers with the contract's envelope (section 1.3). Handlers return a Reply;
// `toUmi` turns a handler into the (req, res) function that Umi's mock loader calls.
import type { MockAdmin } from './store';

export type Envelope<T = unknown> = { code: string; message: string; data: T };

export type Reply = { status: number; body: Envelope };

export type MockReq = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  body: unknown;
};

export type MockRes = {
  status(code: number): MockRes;
  json(body: unknown): unknown;
  setHeader?(name: string, value: string): unknown;
  end?(body?: unknown): unknown;
};

export type AdminReq = MockReq & { admin: MockAdmin };

export const ok = <T>(data: T, status = 200): Reply => ({
  status,
  body: { code: '200', message: 'success', data },
});

export const fail = (
  httpStatus: number,
  code: string,
  message: string,
  data: unknown = null,
): Reply => ({
  status: httpStatus,
  body: { code, message, data },
});

/** Thrown inside a handler to answer with an error; `guard` turns it into the reply. */
export class MockHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
    readonly data: unknown = null,
  ) {
    super(message);
    this.name = 'MockHttpError';
  }
}

/** 400 INVALID_REQUEST with the details the contract describes (`ref` and a reason code). */
export const invalidRequest = (
  message: string,
  details: { ref: string; reason: string }[],
): MockHttpError => new MockHttpError(400, 'INVALID_REQUEST', message, { details });

const INTERNAL_ERROR_REPLY = (): Reply => fail(500, 'INTERNAL_ERROR', 'Internal error');

export const replyFromError = (error: unknown): Reply => {
  if (error instanceof MockHttpError)
    return fail(error.httpStatus, error.code, error.message, error.data);
  // The only output of the mock backend: a handler that crashed would otherwise leave no trace.
  console.error('[avatar-admin] mock handler failed:', error);
  return INTERNAL_ERROR_REPLY();
};

export type Handler = (req: MockReq) => Reply | Promise<Reply>;

const isReply = (value: unknown): value is Reply =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Reply).status === 'number' &&
  typeof (value as Reply).body === 'object' &&
  (value as Reply).body !== null;

/**
 * The function Umi's mock loader calls: runs the handler and writes its reply. Nothing a handler
 * does can take the dev server down: a thrown error, a missing `return`, or a body that cannot be
 * written as JSON all become a 500 INTERNAL_ERROR envelope.
 */
export function toUmi(handler: Handler) {
  return async (req: MockReq, res: MockRes): Promise<void> => {
    let reply: Reply;
    try {
      const result = await handler(req);
      reply = isReply(result)
        ? result
        : replyFromError(new Error('the handler did not return a reply'));
    } catch (error) {
      reply = replyFromError(error);
    }
    try {
      res.status(reply.status).json(reply.body);
    } catch (error) {
      const fallback = replyFromError(error);
      res.status(fallback.status).json(fallback.body);
    }
  };
}

/** Header value as one string (express gives arrays for repeated headers). */
export const header = (req: MockReq, name: string): string | undefined => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

/** The request body as an object, or an empty object when it is anything else. */
export const bodyOf = (req: MockReq): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};

/** A file answer (an export); anything else a handler returns is the usual JSON reply. */
export type FileReply = { file: { contentType: string; filename: string; body: Buffer } };

/** Like `toUmi`, for handlers that may answer with a file. */
export function toUmiFile(
  handler: (req: MockReq) => Reply | FileReply | Promise<Reply | FileReply>,
) {
  return async (req: MockReq, res: MockRes): Promise<void> => {
    let reply: Reply | FileReply;
    try {
      reply = await handler(req);
    } catch (error) {
      reply = replyFromError(error);
    }
    try {
      if ('file' in reply) {
        res.status(200);
        res.setHeader?.('Content-Type', reply.file.contentType);
        res.setHeader?.('Content-Disposition', `attachment; filename="${reply.file.filename}"`);
        res.end?.(reply.file.body);
        return;
      }
      res.status(reply.status).json(reply.body);
    } catch (error) {
      const fallback = replyFromError(error);
      res.status(fallback.status).json(fallback.body);
    }
  };
}
