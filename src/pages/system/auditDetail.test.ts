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

describe('text that carries a credential: shapes', () => {
  const cases: [string, unknown, string][] = [
    // structured
    ['a password', { password: 'hunter2' }, `{"password":"${HIDDEN}"}`],
    ['a nested token', { a: { b: { token: 't' } } }, `{"a":{"b":{"token":"${HIDDEN}"}}}`],
    ['a list under a secret', { apiKey: ['k1', 'k2'] }, `{"apiKey":["${HIDDEN}","${HIDDEN}"]}`],
    [
      'a date under a password key stays readable',
      { passwordChangedAt: '2026-10-01T08:00:00Z' },
      '{"passwordChangedAt":"2026-10-01T08:00:00Z"}',
    ],
    ['a short number sent as a code', { code: '483920' }, `{"code":"${HIDDEN}"}`],
    [
      'a permission code is not one',
      { code: 'USER:VIEW', n: { code: 'TH' } },
      '{"code":"USER:VIEW","n":{"code":"TH"}}',
    ],
    ['a country calling code is not one', { code: '66' }, '{"code":"66"}'],
    [
      'a setting named by a key such as configKey',
      { configKey: 'facebook.access_token', value: 'EAAB-secret' },
      `{"configKey":"facebook.access_token","value":"${HIDDEN}"}`,
    ],
    [
      'a setting with its change one level down',
      { setting: 'sms.api_secret', changes: { from: 'x', to: 'y' } },
      `{"setting":"sms.api_secret","changes":{"from":"${HIDDEN}","to":"${HIDDEN}"}}`,
    ],
    [
      'a setting with k and v',
      { k: 'facebook.access_token', v: 'EAAB-secret' },
      `{"k":"facebook.access_token","v":"${HIDDEN}"}`,
    ],
    [
      'a jwt, a session, a signature and a salt',
      { jwt: 'a', session: 'b', sessionId: 'c', accessKey: 'd', sig: 'e', salt: 'f' },
      `{"jwt":"${HIDDEN}","session":"${HIDDEN}","sessionId":"${HIDDEN}","accessKey":"${HIDDEN}","sig":"${HIDDEN}","salt":"${HIDDEN}"}`,
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
    [
      'a password with a quote inside',
      'Request body: {"user":"bob","password":"hun\\"ter2"}',
      `Request body: {"user":"bob","password":"${HIDDEN}"}`,
    ],
    [
      'JSON written inside a text',
      '{\\"password\\":\\"hunter2\\"}',
      `{\\"password\\":\\"${HIDDEN}\\"}`,
    ],
    ['a change told in words', 'changed password to hunter2', `changed password to ${HIDDEN}`],
    ['a PIN after a space', 'PIN 1234', `PIN ${HIDDEN}`],
    ['an otp after a space', 'otp 123456', `otp ${HIDDEN}`],
    [
      'a verification code after a space',
      'verification code 123456 sent',
      `verification code ${HIDDEN} sent`,
    ],
    ['a pass key', 'pass=hunter2', `pass=${HIDDEN}`],
    ['a jwt', 'jwt=eyJhbGciOi.eyJzdWIiOiIx.c2ln', `jwt=${HIDDEN}`],
    [
      'a bearer token on its own',
      'sent Bearer abcdefgh12345 to the gateway',
      `sent Bearer ${HIDDEN} to the gateway`,
    ],
    [
      'a date under a password key in text',
      'passwordChangedAt=2026-10-01',
      'passwordChangedAt=2026-10-01',
    ],
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

  it('has at least 45 shapes', () => {
    expect(cases.length).toBeGreaterThanOrEqual(45);
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

describe('the gaps of the second line: names, signed links, change phrases and phrases of words', () => {
  const H = HIDDEN;

  describe('keys that name a credential', () => {
    it.each([
      'auth_key',
      'authKey',
      'AuthKey',
      'auth-key',
      'creds',
      'Creds',
      'cred',
      'refresh',
      'Refresh',
      'accessKey',
      'access_key',
      'ผู้ใช้_auth_key',
    ])('hides the text under the key %s', (key) => {
      expect(maskDetail({ [key]: 'AAA-111' })).toEqual({ [key]: H });
      expect(maskDetail({ nested: [{ [key]: 'AAA-111' }] })).toEqual({ nested: [{ [key]: H }] });
    });

    it('leaves numbers and flags under them alone, as for every credential key', () => {
      expect(maskDetail({ creds: 3, auth_key: true, refresh: false, authKey: null })).toEqual({
        creds: 3,
        auth_key: true,
        refresh: false,
        authKey: null,
      });
    });

    it.each([
      'author',
      'authorKey',
      'authors',
      'authority',
      'authorized',
      'credit',
      'credits',
      'credited',
      'credibility',
      'refreshInterval',
      'refresh_rate',
      'lastRefresh',
      'autoRefresh',
      'refreshed',
      'screds',
      'permissionCodes',
      'keyCount',
      'monkey',
    ])('does not hide the text under the key %s', (key) => {
      expect(maskDetail({ [key]: 'some text' })).toEqual({ [key]: 'some text' });
    });

    it('still leaves permission codes, token version and the flag of a forced password change readable', () => {
      const detail = {
        permissionCodes: ['USER:VIEW', 'USER:BAN'],
        tokenVersion: 3,
        mustChangePassword: true,
        role: 'support',
        creditCost: '5',
        authorName: 'ploy',
      };
      expect(maskDetail(detail)).toEqual(detail);
    });
  });

  describe('signed parameters in a link', () => {
    it.each([
      ['https://files.example.com/a.png?sig=abc123', `https://files.example.com/a.png?sig=${H}`],
      ['https://files.example.com/a.png?Sig=abc123', `https://files.example.com/a.png?Sig=${H}`],
      [
        'https://files.example.com/a.png?a=1&sig=abc123&b=2',
        `https://files.example.com/a.png?a=1&sig=${H}&b=2`,
      ],
      [
        'https://files.example.com/a.png?a=1&sign=abc123#top',
        `https://files.example.com/a.png?a=1&sign=${H}#top`,
      ],
      ['/files/a.png?expires=1&hmac=deadbeef', `/files/a.png?expires=1&hmac=${H}`],
      ['"link":"x.com/a?sig=Zm9v%2Bbar%3D"', `"link":"x.com/a?sig=${H}"`],
      ['see (https://x.com/a?sig=abc) and more', `see (https://x.com/a?sig=${H}) and more`],
      ['https://x.com/a?id=1;sig=abc;ok=1', `https://x.com/a?id=1;sig=${H};ok=1`],
      ['https://x.com/ผู้ใช้/ภาพ.png?sig=ab12&lang=th', `https://x.com/ผู้ใช้/ภาพ.png?sig=${H}&lang=th`],
    ])('hides the signature in %s', (input, expected) => {
      expect(detailText(input)).toBe(expected);
      expect(detailText({ url: input })).toBe(JSON.stringify({ url: expected }));
    });

    it.each([
      'https://x.com/a?design=blue&assign=me',
      'https://x.com/a?signal=1&significant=yes',
      'sign in to continue',
      'please sign=up here',
      'the sig is a short name',
      'https://x.com/a?id=1&page=2',
      'https://x.com/signature-page?id=1',
      'https://x.com/sig/abc/sign',
    ])('does not hide anything in %s', (input) => {
      expect(detailText(input)).toBe(input);
    });
  });

  describe('a change told in words', () => {
    it.each([
      ['reset password for user x to Hunter2!', `reset password for user x to ${H}`],
      ['Reset password for user ploy to Hunter2!', `Reset password for user ploy to ${H}`],
      ['password for user ploy to Hunter2! done', `password for user ploy to ${H} done`],
      ['reset password for bob to Hunter2!', `reset password for bob to ${H}`],
      [
        'reset the password of user anna smith to Hunter2!',
        `reset the password of user anna smith to ${H}`,
      ],
      ['password was changed to Hunter2!', `password was changed to ${H}`],
      ['password changed to Hunter2!', `password changed to ${H}`],
      ['password reset to Hunter2!', `password reset to ${H}`],
      ['password has been updated to Hunter2!', `password has been updated to ${H}`],
      [
        'restablecer contraseña de usuario ana a Hunter2!',
        `restablecer contraseña de usuario ana a ${H}`,
      ],
      [
        'reset kata sandi untuk pengguna budi menjadi Hunter2!',
        `reset kata sandi untuk pengguna budi menjadi ${H}`,
      ],
      [
        'đặt lại mật khẩu cho người dùng an thành Hunter2!',
        `đặt lại mật khẩu cho người dùng an thành ${H}`,
      ],
      ['将用户的密码重置为 Hunter2!', `将用户的密码重置为 ${H}`],
      ['密码改为Hunter2!', `密码改为${H}`],
      ['set sms.api_key from AAA to BBB', `set sms.api_key from ${H} to ${H}`],
      [
        'config sms.api_secret changed from old123 to new456',
        `config sms.api_secret changed from ${H} to ${H}`,
      ],
      ['rotated api_key from "old one" to \'new one\'', `rotated api_key from "${H}" to '${H}'`],
      ['changed password from old123 to new456', `changed password from ${H} to ${H}`],
      ['password was changed from old123 to new456', `password was changed from ${H} to ${H}`],
      [
        'updated facebook.access_token from EAAB-old to EAAB-new by ploy',
        `updated facebook.access_token from ${H} to ${H} by ploy`,
      ],
      ['set sms.auth_key from ผู้ใช้ to ก็ก็', `set sms.auth_key from ${H} to ${H}`],
    ])('%s', (input, expected) => {
      expect(detailText(input)).toBe(expected);
    });

    it.each([
      'reset password for user x',
      'reset password for user x was done by admin',
      'password reset requested for user x',
      'password for user x was reset by admin',
      'Changed password for user x',
      'sent a password reset link for user x to ploy@example.com',
      'changed sms.daily_cap from 100 to 200',
      'changed the limit from 5 to 10',
      'moved token from header to body',
      'password policy updated',
      'changed settings from the old page to the new page',
      'role changed from support to admin',
      'مستخدم x: إعادة تعيين كلمة المرور',
      'đã đổi thứ tự từ 1 sang 2',
    ])('does not hide anything in %s', (input) => {
      expect(detailText(input)).toBe(input);
    });
  });

  describe('a value of several words after an equals sign', () => {
    it.each([
      ['password=hunter two', `password=${H}`],
      ['password=hunter two three four five', `password=${H}`],
      ['password=correct horse battery staple', `password=${H}`],
      ['Password=correct horse battery staple.', `Password=${H}`],
      ['set password=hunter two for anna', `set password=${H} for anna`],
      ['set password=hunter two, then log in', `set password=${H}, then log in`],
      ['secret=blue cheese; next=1', `secret=${H}; next=1`],
      ['token=abc def user=bob', `token=${H} user=bob`],
      ['password=contraseña secreta', `password=${H}`],
      ['password=пароль мой', `password=${H}`],
      ['password=ก็ก็ ก็ก็', `password=${H}`],
      ['password=hunter two and he left', `password=${H} and he left`],
      // five words go on after the first; a sixth is not taken
      ['password=one two three four five six seven eight', `password=${H} seven eight`],
      ['access_key=AKIAIOSFODNN7 next', `access_key=${H} next`],
      ['accessKey: AKIAIOSFODNN7EXAMPLE', `accessKey: ${H}`],
      ['auth_key=abc123 creds=xyz789', `auth_key=${H} creds=${H}`],
    ])('%s', (input, expected) => {
      expect(detailText(input)).toBe(expected);
    });

    it('keeps what it kept before: one word with a digit, a flag, a date, and words after the colon or "is"', () => {
      expect(detailText('set password=hunter2 for anna')).toBe(`set password=${H} for anna`);
      expect(detailText('mustChangePassword=true now')).toBe('mustChangePassword=true now');
      expect(detailText('passwordChangedAt=2026-10-01 by admin')).toBe(
        'passwordChangedAt=2026-10-01 by admin',
      );
      expect(detailText('password: wrong again')).toBe(`password: ${H} again`);
      expect(detailText('password is wrong again')).toBe(`password is ${H} again`);
      expect(detailText('tokenVersion=3 updated')).toBe('tokenVersion=3 updated');
    });
  });

  describe('a private key written into text', () => {
    const pem = (kind: string) =>
      `-----BEGIN ${kind}-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\nabc123+/==\n-----END ${kind}-----`;

    it.each(['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'ENCRYPTED PRIVATE KEY'])(
      'hides the body of a %s block, also with text around it',
      (kind) => {
        expect(detailText(`uploaded ${pem(kind)} for sms`)).toBe(`uploaded ${H} for sms`);
        expect(detailText({ note: pem(kind) })).toBe(JSON.stringify({ note: H }));
      },
    );

    it('hides to the end of a block that was cut off', () => {
      expect(detailText('key: -----BEGIN PRIVATE KEY-----\nMIIEvQIBAD')).toBe(`key: ${H}`);
    });

    it('leaves a public key and a certificate alone', () => {
      const text = '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----';
      expect(detailText(text)).toBe(text);
      const pub = '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----';
      expect(detailText(pub)).toBe(pub);
    });
  });

  describe('time', () => {
    const text200k = (unit: string) =>
      unit.repeat(Math.ceil(200000 / unit.length)).slice(0, 200000);
    const hostile = [
      'password for ',
      'password for user x to ',
      'password=a ',
      'password=a b c d e f g h ',
      'set sms.api_key from ',
      'set sms.api_key from a to ',
      'changed password from a to ',
      'password was changed to ',
      '?sig=',
      '&sig=a',
      '-----BEGIN PRIVATE KEY-----',
      'creds ',
      'password=',
      `password for ${'x'.repeat(50)} `,
      'auth_key=a ',
      'ก็ก็ password=ก็ก็ ',
    ];

    it.each(hostile)('takes milliseconds, not seconds, on 200000 characters of %j', (unit) => {
      const input = text200k(unit);
      const started = performance.now();
      detailText(input);
      detailText({ [`k${unit.length}`]: input });
      const took = performance.now() - started;
      expect(took).toBeLessThan(1500);
    });

    it('does not take longer per character on a text four times as long (it is linear)', () => {
      const time = (n: number) => {
        const input =
          'set password=a b c d for user x to y; sms.api_key from a to b ?sig=1&'.repeat(n);
        const started = performance.now();
        detailText(input);
        return performance.now() - started;
      };
      time(100); // warm up
      const small = Math.max(time(500), 1);
      const large = time(2000);
      expect(large / small).toBeLessThan(12);
    });
  });
});
