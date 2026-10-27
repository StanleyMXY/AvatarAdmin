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

  it('hides the string value of a key that names a credential, at any depth and in a list; a number stays', () => {
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
      tokenVersion: 3,
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
    let deep: Record<string, unknown> = { note: 'LEAF-OF-THE-DEEP-TREE' };
    for (let i = 0; i < 200; i += 1) deep = { child: deep };
    expect(() => detailText(deep)).not.toThrow();
    expect(detailText(deep)).not.toContain('LEAF-OF-THE-DEEP-TREE');
    expect(detailText(deep)).toContain('…');
  });
});

describe('only text is hidden: numbers, booleans and nothing stay what they are', () => {
  it('does not hide tokenVersion, mustChangePassword and other values of a key that merely names a credential', () => {
    expect(maskDetail({ mustChangePassword: true })).toEqual({ mustChangePassword: true });
    expect(maskDetail({ mustChangePassword: { old: false, new: true } })).toEqual({
      mustChangePassword: { old: false, new: true },
    });
    expect(maskDetail({ tokenVersion: { old: 3, new: 4 } })).toEqual({
      tokenVersion: { old: 3, new: 4 },
    });
    expect(maskDetail({ passwordMinLength: 12, totpEnrolled: false, secretCount: 0 })).toEqual({
      passwordMinLength: 12,
      totpEnrolled: false,
      secretCount: 0,
    });
    expect(maskDetail({ password: null, token: undefined })).toEqual({
      password: null,
      token: undefined,
    });
  });

  it('shows what changed in a reset of the password or of the second factor', () => {
    expect(detailText({ mustChangePassword: true, tokenVersion: { old: 3, new: 4 } })).toBe(
      '{"mustChangePassword":true,"tokenVersion":{"old":3,"new":4}}',
    );
  });

  it('still hides the text inside an object or a list under such a key, and keeps the numbers next to it', () => {
    expect(
      maskDetail({
        token: { value: 'abc', count: 3, ok: true, list: ['x', 1, false, null] },
      }),
    ).toEqual({
      token: { value: HIDDEN, count: 3, ok: true, list: [HIDDEN, 1, false, null] },
    });
  });

  it('hides a text in JSON text the same way: text yes, number and boolean no', () => {
    expect(detailText('{"tokenVersion":3,"mustChangePassword":true,"password":"p"}')).toBe(
      `{"tokenVersion":3,"mustChangePassword":true,"password":"${HIDDEN}"}`,
    );
  });
});

describe('a value that is named by its sibling: the key and the old and new value', () => {
  it('hides old and new when the key or field next to them names a credential', () => {
    expect(maskDetail({ key: 'sms.api_secret', old: 'abc', new: 'def' })).toEqual({
      key: 'sms.api_secret',
      old: HIDDEN,
      new: HIDDEN,
    });
    expect(maskDetail({ field: 'password', before: 'a', after: 'b', changedBy: 'root' })).toEqual({
      field: 'password',
      before: HIDDEN,
      after: HIDDEN,
      changedBy: 'root',
    });
    expect(maskDetail({ name: 'facebookAccessToken', oldValue: 'x', newValue: 'y' })).toEqual({
      name: 'facebookAccessToken',
      oldValue: HIDDEN,
      newValue: HIDDEN,
    });
  });

  it('leaves old and new alone when the key next to them is not a credential', () => {
    expect(maskDetail({ key: 'sms.daily_cap', old: '100', new: '200' })).toEqual({
      key: 'sms.daily_cap',
      old: '100',
      new: '200',
    });
    expect(maskDetail({ old: 'abc', new: 'def' })).toEqual({ old: 'abc', new: 'def' });
  });

  it('hides old and new that sit under a key that names a credential (a map of changes)', () => {
    expect(
      detailText({
        'sms.api_secret': { old: 'abc', new: 'def' },
        'sms.daily_cap': { old: 1, new: 2 },
      }),
    ).toBe(
      `{"sms.api_secret":{"old":"${HIDDEN}","new":"${HIDDEN}"},"sms.daily_cap":{"old":1,"new":2}}`,
    );
  });
});

describe('keys in the languages of the product', () => {
  it.each([
    ['Russian', 'пароль'],
    ['Thai', 'รหัสผ่าน'],
    ['Arabic', 'كلمة المرور'],
    ['Spanish', 'contraseña'],
    ['Spanish without the tilde', 'contrasena'],
    ['Indonesian', 'kata_sandi'],
    ['Vietnamese', 'mật_khẩu'],
    ['Chinese', '密码'],
    ['Chinese, traditional', '密碼'],
  ])('hides the text under a key in %s', (_language, key) => {
    expect(maskDetail({ [key]: 'hunter2' })).toEqual({ [key]: HIDDEN });
  });

  it('leaves a key that only looks like one in another language alone', () => {
    expect(maskDetail({ ชื่อ: 'สมชาย', اسم: 'علي', nombre: 'José', 名称: '角色' })).toEqual({
      ชื่อ: 'สมชาย',
      اسم: 'علي',
      nombre: 'José',
      名称: '角色',
    });
  });
});

describe('codes that are sent to a person: only the ones that are a credential', () => {
  it('hides a verification code, a one time code and the like', () => {
    expect(
      maskDetail({
        otpCode: '123456',
        verificationCode: '123456',
        verify_code: '1',
        smsCode: '1',
        emailCode: '1',
        authCode: '1',
        resetCode: '1',
        recoveryCodes: ['a', 'b'],
        backupCode: '1',
        otp: '1',
        userPin: '1',
      }),
    ).toEqual({
      otpCode: HIDDEN,
      verificationCode: HIDDEN,
      verify_code: HIDDEN,
      smsCode: HIDDEN,
      emailCode: HIDDEN,
      authCode: HIDDEN,
      resetCode: HIDDEN,
      recoveryCodes: [HIDDEN, HIDDEN],
      backupCode: HIDDEN,
      otp: HIDDEN,
      userPin: HIDDEN,
    });
  });

  it('leaves a permission code, an error code, a country code and the like alone', () => {
    const plain = {
      code: 'USER:VIEW',
      permissionCodes: { added: ['MODERATION:VIEW'], removed: [] },
      errorCode: 'INVALID_STATE',
      countryCode: 'TH',
      phoneCountryCode: '+66',
      statusCode: '409',
      languageCode: 'th',
      inviteCode: 'ABC123',
    };
    expect(maskDetail(plain)).toEqual(plain);
  });
});

describe('text that carries a credential: 33 shapes', () => {
  const cases: [string, unknown, string][] = [
    // structured
    ['a password', { password: 'hunter2' }, `{"password":"${HIDDEN}"}`],
    ['a nested token', { a: { b: { token: 't' } } }, `{"a":{"b":{"token":"${HIDDEN}"}}}`],
    ['a list under a secret', { apiKey: ['k1', 'k2'] }, `{"apiKey":["${HIDDEN}","${HIDDEN}"]}`],
    [
      'a date under a password key',
      { passwordChangedAt: '2026-10-01' },
      `{"passwordChangedAt":"${HIDDEN}"}`,
    ],
    [
      'old and new next to a secret key',
      { key: 'sms.api_secret', old: 'a', new: 'b' },
      `{"key":"sms.api_secret","old":"${HIDDEN}","new":"${HIDDEN}"}`,
    ],
    ['a Thai key', { รหัสผ่าน: 'x' }, `{"รหัสผ่าน":"${HIDDEN}"}`],
    ['a Russian key', { пароль: 'x' }, `{"пароль":"${HIDDEN}"}`],
    ['a verification code', { verificationCode: '123456' }, `{"verificationCode":"${HIDDEN}"}`],
    // plain text
    ['key=value', 'set password=hunter2 for anna', `set password=${HIDDEN} for anna`],
    ['key: value', 'token: abc.def.ghi, kept', `token: ${HIDDEN}, kept`],
    ['key = value', 'apiKey = zzz', `apiKey = ${HIDDEN}`],
    ['no space after the colon', 'Password:hunter2', `Password:${HIDDEN}`],
    ['the word is', 'password is hunter2', `password is ${HIDDEN}`],
    ['a bearer token', 'Authorization: Bearer eyJhbGciOi.payload.sig', `Authorization: ${HIDDEN}`],
    ['a basic scheme', 'authorization=Basic dXNlcjpwYXNz', `authorization=${HIDDEN}`],
    ['a cookie', 'cookie: sid=abc; Path=/', `cookie: ${HIDDEN}; Path=/`],
    ['a quoted value with a space', "password: 'hunter two' done", `password: '${HIDDEN}' done`],
    ['a double quoted value', 'password="hunter two" done', `password="${HIDDEN}" done`],
    ['JSON that was cut', '{"password":"hunter2","a":', `{"password":"${HIDDEN}","a":`],
    ['JSON that was cut inside the value', '{"password":"hunt', `{"password":"${HIDDEN}`],
    ['JSON after a prefix', 'body={"password":"hunter2"}', `body={"password":"${HIDDEN}"}`],
    ['JSON in text, nested', '{"nested":{"secret":"s"}}', `{"nested":{"secret":"${HIDDEN}"}}`],
    ['a list of JSON', '[{"token":"t"}]', `[{"token":"${HIDDEN}"}]`],
    [
      'a user and password in an address',
      'https://admin:hunter2@example.com/x',
      `https://admin:${HIDDEN}@example.com/x`,
    ],
    ['a short word', 'pwd=abc', `pwd=${HIDDEN}`],
    ['a one time password', 'otp: 123456', `otp: ${HIDDEN}`],
    ['a verification code in words', 'verification code: 123456', `verification code: ${HIDDEN}`],
    ['a Thai word', 'รหัสผ่าน: hunter2', `รหัสผ่าน: ${HIDDEN}`],
    ['a Russian word', 'пароль=hunter2', `пароль=${HIDDEN}`],
    ['a Chinese word', '密码：hunter2', `密码：${HIDDEN}`],
    // not a credential
    ['a number of the version of a token', 'tokenVersion: 4', 'tokenVersion: 4'],
    ['a boolean flag', 'mustChangePassword: true', 'mustChangePassword: true'],
    [
      'a sentence about passwords',
      'a message about passwords in general',
      'a message about passwords in general',
    ],
    [
      'a word that contains one of the short words',
      'footprint: 3, spinning: x',
      'footprint: 3, spinning: x',
    ],
  ];

  it.each(cases)('%s', (_name, input, expected) => {
    expect(detailText(input)).toBe(expected);
  });

  it('has at least 33 shapes', () => {
    expect(cases.length).toBeGreaterThanOrEqual(33);
  });

  it('stays linear on a very long text with no spaces, with many separators or with a value that never ends', () => {
    // a search that is quadratic in the length takes minutes on these; a linear one a fraction of a second
    const started = Date.now();
    detailText('a'.repeat(200000));
    detailText('a-'.repeat(100000));
    detailText('token '.repeat(40000));
    detailText('token-'.repeat(40000));
    detailText('http://u:'.repeat(30000));
    detailText(`password=${'x'.repeat(200000)}`);
    detailText(`{"password":"${'x'.repeat(200000)}`);
    expect(Date.now() - started).toBeLessThan(10000);
  }, 60000);

  it('keeps Arabic, Thai and emoji around a hidden value', () => {
    expect(detailText(`مرحبا password=hunter2 ก็ก็ ${String.fromCodePoint(0x1f600)}`)).toBe(
      `مرحبا password=${HIDDEN} ก็ก็ ${String.fromCodePoint(0x1f600)}`,
    );
  });
});
