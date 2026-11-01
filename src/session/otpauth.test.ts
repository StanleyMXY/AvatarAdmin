import { describe, expect, it } from 'vitest';
import { groupKey, setupKeyOf } from './otpauth';

describe('setupKeyOf: the key to type by hand, read from the otpauth address the server sent', () => {
  it('takes the secret of an otpauth address', () => {
    expect(setupKeyOf('otpauth://totp/Admin:ploy?secret=JBSWY3DPEHPK3PXP&issuer=Admin')).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('takes it wherever it is in the query, in any case, with padding and with spaces or dashes removed', () => {
    expect(setupKeyOf('otpauth://totp/x?issuer=A&secret=jbswy3dp ehpk-3pxp==&algorithm=SHA1')).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('works with a label in any script', () => {
    expect(
      setupKeyOf(
        'otpauth://totp/%E0%B8%9C%E0%B8%B9%E0%B9%89%E0%B8%94%E0%B8%B9%E0%B9%81%E0%B8%A5?secret=MFRGGZDFMZTWQ2LK',
      ),
    ).toBe('MFRGGZDFMZTWQ2LK');
  });

  it('gives nothing when there is no usable secret: no secret, not base32, not an otpauth address, not text', () => {
    for (const bad of [
      'otpauth://totp/x?issuer=A',
      'otpauth://totp/x?secret=',
      'otpauth://totp/x?secret=not*base32!',
      'otpauth://totp/x?secret=0189',
      'https://example.com/?secret=JBSWY3DPEHPK3PXP',
      'not an address',
      '',
      undefined,
      null,
      42,
    ]) {
      expect(setupKeyOf(bad as never), String(bad)).toBeNull();
    }
  });
});

describe('groupKey', () => {
  it('writes the key in groups of four, which is how it is read and typed', () => {
    expect(groupKey('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupKey('ABCDEF')).toBe('ABCD EF');
    expect(groupKey('')).toBe('');
  });
});
