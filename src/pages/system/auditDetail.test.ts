import { describe, expect, it } from 'vitest';
import { detailText, HIDDEN, maskDetail } from './auditDetail';

describe('the detail of an audit row', () => {
  it('shows text as it is and writes other values out, whatever their type', () => {
    expect(detailText('ยกเลิกการระงับบัญชี')).toBe('ยกเลิกการระงับบัญชี');
    expect(detailText(42)).toBe('42');
    expect(detailText(true)).toBe('true');
    expect(detailText(null)).toBe('');
    expect(detailText(undefined)).toBe('');
    expect(detailText({ reason: 'Spam', n: 1 })).toBe('{"reason":"Spam","n":1}');
    expect(detailText(['a', 2])).toBe('["a",2]');
  });

  it('does not throw on a value that cannot be written out', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => detailText(loop)).not.toThrow();
    expect(detailText(BigInt(5) as unknown)).toBe('5');
  });

  it('hides the value of a key that names a credential, at any depth and in a list', () => {
    const masked = maskDetail({
      name: 'Q4',
      password: 'hunter2',
      newPassword: 'hunter3',
      nested: { facebookAccessToken: 'EAAB-secret', list: [{ api_key: 'k1' }, { ok: 1 }] },
      Authorization: 'Bearer abc',
      clientSecret: 's',
      totpSecret: 't',
      tokenVersion: 3,
    }) as Record<string, unknown>;
    expect(masked).toEqual({
      name: 'Q4',
      password: HIDDEN,
      newPassword: HIDDEN,
      nested: { facebookAccessToken: HIDDEN, list: [{ api_key: HIDDEN }, { ok: 1 }] },
      Authorization: HIDDEN,
      clientSecret: HIDDEN,
      totpSecret: HIDDEN,
      tokenVersion: HIDDEN,
    });
  });

  it('leaves the keys that only look like a credential alone', () => {
    expect(
      maskDetail({ footprint: 1, potential: 2, status: 'BANNED', code: 'USER:VIEW', note: 'x' }),
    ).toEqual({
      footprint: 1,
      potential: 2,
      status: 'BANNED',
      code: 'USER:VIEW',
      note: 'x',
    });
  });

  it('hides a credential in text that is JSON, and in text that says key=value', () => {
    expect(detailText('{"password":"hunter2","name":"a"}')).toBe(
      `{"password":"${HIDDEN}","name":"a"}`,
    );
    expect(detailText('set password=hunter2 for anna')).toBe(`set password=${HIDDEN} for anna`);
    expect(detailText('token: abc.def.ghi, kept')).toBe(`token: ${HIDDEN}, kept`);
    expect(detailText('apiKey = zzz')).toBe(`apiKey = ${HIDDEN}`);
    expect(detailText('a message about passwords in general')).toBe(
      'a message about passwords in general',
    );
  });

  it('keeps a long text, Arabic, Thai and emoji whole', () => {
    const long = 'x'.repeat(5000);
    expect(detailText(long)).toBe(long);
    expect(detailText({ note: `مرحبا ก็ก็ ${String.fromCodePoint(0x1f600)}` })).toContain('مرحبا');
  });

  it('does not change the value it is given', () => {
    const original = { password: 'p', nested: { token: 't' } };
    maskDetail(original);
    expect(original).toEqual({ password: 'p', nested: { token: 't' } });
  });

  it('stops at a depth where a hostile value would take too long', () => {
    let deep: Record<string, unknown> = { password: 'x' };
    for (let i = 0; i < 200; i += 1) deep = { child: deep };
    expect(() => detailText(deep)).not.toThrow();
    expect(detailText(deep)).not.toContain('"x"');
  });
});
