import { beforeEach, describe, expect, it } from 'vitest';
import type { MockReq, MockRes } from './_core/http';
import { addDays, todayOf } from './_core/statData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call as callJson } from './_core/testing';
import { buildXlsx } from './_core/xlsx';
import exportMock from './export.mock';

beforeEach(() => resetStore());

const handler = (
  exportMock as unknown as Record<string, (req: MockReq, res: MockRes) => Promise<void>>
)['GET /api/admin/stats/export/:name'];

type Answer = {
  status: number;
  headers: Record<string, string>;
  file?: Buffer;
  json?: { code: string };
};

async function download(
  user: string | null,
  name: string,
  query: Record<string, string> = {},
): Promise<Answer> {
  const answer: Answer = { status: 0, headers: {} };
  const res: MockRes = {
    status(code) {
      answer.status = code;
      return res;
    },
    json(body) {
      answer.json = body as { code: string };
      return undefined;
    },
    setHeader(key, value) {
      answer.headers[key] = value;
    },
    end(body) {
      answer.file = body as Buffer;
    },
  };
  await handler(
    {
      headers: user ? { authorization: bearer(issueToken(adminOf(user)).token).authorization } : {},
      query,
      params: { name },
      body: undefined,
    },
    res,
  );
  return answer;
}

/** The names and the contents of the entries of a zip, read from its central directory. */
function entriesOf(zip: Buffer): Record<string, string> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    const offset = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const dataStart = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    out[name] = zip.toString('utf8', dataStart, dataStart + size);
    at += 46 + nameLength + extra;
  }
  return out;
}

const today = todayOf();
const range = { from: addDays(today, -2), to: today };

describe('GET /stats/export/:name', () => {
  it('gives a spreadsheet file with a header and one row per day, named after the report and the range', async () => {
    const a = await download('finance', 'daily', range);
    expect(a.status).toBe(200);
    expect(a.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(a.headers['Content-Disposition']).toBe(
      `attachment; filename="daily-${range.from}-${range.to}.xlsx"`,
    );
    const files = entriesOf(a.file as Buffer);
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    expect((files['xl/worksheets/sheet1.xml'].match(/<row /g) ?? []).length).toBe(4);
    expect(files['xl/worksheets/sheet1.xml']).toContain(range.from);
  });

  it('needs STATS:EXPORT and the permission of the report itself', async () => {
    expect((await download('support', 'daily', range)).status).toBe(403); // STATS:VIEW but no STATS:EXPORT
    expect((await download('finance', 'invite-records', range)).status).toBe(403); // no INVITE:VIEW
    expect((await download('finance', 'usage-cost', range)).status).toBe(200); // COST:VIEW and STATS:EXPORT
  });

  it('refuses without a token, for an unknown name, and for a bad range, with a JSON answer and no file', async () => {
    const noToken = await download(null, 'daily', range);
    expect(noToken.status).toBe(401);
    expect(noToken.file).toBeUndefined();
    expect((await download('root', 'nope', range)).status).toBe(404);
    const bad = await download('root', 'daily', { from: 'x', to: 'y' });
    expect(bad.status).toBe(400);
    expect(bad.json?.code).toBe('INVALID_REQUEST');
    expect(bad.file).toBeUndefined();
  });

  it('answers 429 RATE_LIMITED after ten exports in an hour, as JSON, with no file', async () => {
    for (let i = 0; i < 10; i++) expect((await download('root', 'daily', range)).status).toBe(200);
    const limited = await download('root', 'daily', range);
    expect(limited.status).toBe(429);
    expect(limited.json?.code).toBe('RATE_LIMITED');
    expect(limited.file).toBeUndefined();
  });
});

describe('buildXlsx', () => {
  it('writes numbers, texts in many scripts and escaped markup', () => {
    const files = entriesOf(
      buildXlsx([
        ['name', 'n'],
        ['สวัสดี <b> & "q"', 3],
        ['مرحبا', null],
        ['😀', 1.5],
      ]),
    );
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('สวัสดี &lt;b&gt; &amp; &quot;q&quot;');
    expect(sheet).toContain('مرحبا');
    expect(sheet).toContain('😀');
    expect(sheet).toContain('<c r="B2"><v>3</v></c>');
    expect(sheet).not.toContain('r="B3"');
    expect(sheet).toContain('<v>1.5</v>');
  });

  it('names columns beyond Z', () => {
    const row = Array.from({ length: 28 }, (_, i) => i);
    expect(entriesOf(buildXlsx([row]))['xl/worksheets/sheet1.xml']).toContain('r="AB1"');
  });
});

void callJson;
