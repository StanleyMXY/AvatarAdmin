import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { validateServerLink } from '../../utils/linkRule';
import { validateStoreUrl } from './storeUrl';

const PKG = 'com.example.avatar';
const PLAY = `https://play.google.com/store/apps/details?id=${PKG}`;
const reasonOf = (platform: 'ANDROID' | 'IOS', url: string, ...pkg: [string?]) => {
  const check = validateStoreUrl(platform, url, pkg.length > 0 ? pkg[0] : PKG);
  return check.ok ? null : check.reasonKey;
};
const NBSP = String.fromCharCode(0xa0);
const ZERO_WIDTH = String.fromCharCode(0x200b);
const RLO = String.fromCharCode(0x202e);
const CYRILLIC_A = String.fromCharCode(0x430);

describe('validateStoreUrl, Android (contract 24.2)', () => {
  it('accepts the plain Play link of the application', () => {
    expect(validateStoreUrl('ANDROID', PLAY, PKG)).toEqual({ ok: true });
  });

  it('accepts hl and gl, each once, in any order, with the usual values', () => {
    for (const query of [
      `id=${PKG}&hl=en`,
      `id=${PKG}&gl=US`,
      `id=${PKG}&hl=th&gl=TH`,
      `hl=pt-BR&id=${PKG}&gl=BR`,
      `gl=ID&hl=id_ID&id=${PKG}`,
      `id=${PKG}&hl=zh-Hans`,
      `id=${PKG}&hl=ar&gl=SA`,
      `id=${PKG}&hl=es-419`,
    ]) {
      expect(
        validateStoreUrl('ANDROID', `https://play.google.com/store/apps/details?${query}`, PKG),
        query,
      ).toEqual({
        ok: true,
      });
    }
  });

  it('does not mind the case of the host', () => {
    expect(
      validateStoreUrl('ANDROID', PLAY.replace('play.google.com', 'PLAY.Google.COM'), PKG),
    ).toEqual({ ok: true });
  });

  it('without a package name, accepts an id that is shaped like an application id and nothing else', () => {
    expect(validateStoreUrl('ANDROID', PLAY)).toEqual({ ok: true });
    expect(validateStoreUrl('ANDROID', PLAY, '')).toEqual({ ok: true });
    expect(
      reasonOf('ANDROID', 'https://play.google.com/store/apps/details?id=nodots', undefined),
    ).toBe('appVersions.storeUrl.idInvalid');
    expect(
      reasonOf('ANDROID', 'https://play.google.com/store/apps/details?id=1abc.def', undefined),
    ).toBe('appVersions.storeUrl.idInvalid');
  });

  it('refuses a link that is not https', () => {
    expect(reasonOf('ANDROID', PLAY.replace('https', 'http'))).toBe('reason.NOT_HTTPS');
    expect(reasonOf('ANDROID', PLAY.replace('https', 'HTTPS'))).toBe('reason.NOT_HTTPS');
    expect(reasonOf('ANDROID', `//play.google.com/store/apps/details?id=${PKG}`)).toBe(
      'reason.NOT_HTTPS',
    );
    expect(reasonOf('ANDROID', 'market://details?id=com.example.avatar')).toBe('reason.NOT_HTTPS');
    expect(reasonOf('ANDROID', '')).toBe('appVersions.storeUrl.empty');
  });

  it('refuses a host that is not play.google.com exactly', () => {
    const hosts = [
      'play.google.com.evil.com',
      'evilplay.google.com',
      'play.google.com.',
      'www.play.google.com',
      'play.google.co',
      'play.google.com-evil.com',
      'google.com',
      'apps.apple.com',
      'play_google.com',
      'evil.com',
    ];
    for (const host of hosts) {
      expect(reasonOf('ANDROID', `https://${host}/store/apps/details?id=${PKG}`), host).toBe(
        'appVersions.storeUrl.androidHost',
      );
    }
  });

  it('refuses user information, a port and a fragment', () => {
    expect(reasonOf('ANDROID', `https://user@play.google.com/store/apps/details?id=${PKG}`)).toBe(
      'reason.INVALID_HOST',
    );
    expect(
      reasonOf('ANDROID', `https://play.google.com@evil.com/store/apps/details?id=${PKG}`),
    ).toBe('reason.INVALID_HOST');
    expect(
      reasonOf('ANDROID', `https://user:pw@play.google.com/store/apps/details?id=${PKG}`),
    ).toBe('reason.INVALID_HOST');
    expect(reasonOf('ANDROID', `https://play.google.com:443/store/apps/details?id=${PKG}`)).toBe(
      'appVersions.storeUrl.port',
    );
    expect(reasonOf('ANDROID', `https://play.google.com:/store/apps/details?id=${PKG}`)).toBe(
      'reason.INVALID_PORT',
    );
    expect(reasonOf('ANDROID', `${PLAY}#details`)).toBe('appVersions.storeUrl.fragment');
    expect(reasonOf('ANDROID', `${PLAY}#`)).toBe('appVersions.storeUrl.fragment');
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG}&hl=en#x`),
    ).toBe('appVersions.storeUrl.fragment');
    expect(
      reasonOf('ANDROID', `https://play.google.com\\@evil.com/store/apps/details?id=${PKG}`),
    ).toBe('reason.INVALID_HOST');
  });

  it('refuses another path', () => {
    for (const path of [
      '/store/apps',
      '/store/apps/details/',
      '/store/apps/Details',
      '/Store/apps/details',
      '/store/apps/details;x=1',
      '/store/apps/details%2F',
      '/store/apps/category/GAME',
      '/',
      '',
      '//store/apps/details',
      '/x/../store/apps/details',
    ]) {
      expect(reasonOf('ANDROID', `https://play.google.com${path}?id=${PKG}`), path).toBe(
        'appVersions.storeUrl.androidPath',
      );
    }
  });

  it('needs the id, once, equal to the package name', () => {
    expect(reasonOf('ANDROID', 'https://play.google.com/store/apps/details')).toBe(
      'appVersions.storeUrl.idMissing',
    );
    expect(reasonOf('ANDROID', 'https://play.google.com/store/apps/details?')).toBe(
      'appVersions.storeUrl.queryKey',
    );
    expect(reasonOf('ANDROID', 'https://play.google.com/store/apps/details?hl=en')).toBe(
      'appVersions.storeUrl.idMissing',
    );
    expect(reasonOf('ANDROID', 'https://play.google.com/store/apps/details?id=')).toBe(
      'appVersions.storeUrl.idMismatch',
    );
    expect(reasonOf('ANDROID', 'https://play.google.com/store/apps/details?id=com.other.app')).toBe(
      'appVersions.storeUrl.idMismatch',
    );
    expect(reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG}.pro`)).toBe(
      'appVersions.storeUrl.idMismatch',
    );
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG.toUpperCase()}`),
    ).toBe('appVersions.storeUrl.idMismatch');
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG}&id=${PKG}`),
    ).toBe('appVersions.storeUrl.duplicateParam');
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG}&id=com.other.app`),
    ).toBe('appVersions.storeUrl.duplicateParam');
    expect(reasonOf('ANDROID', `https://play.google.com/store/apps/details?id==${PKG}`)).toBe(
      'appVersions.storeUrl.idMismatch',
    );
  });

  it('refuses any other parameter, including referrer', () => {
    for (const extra of [
      'referrer=utm_source%3Dx',
      'utm_source=x',
      'ID=com.example.avatar',
      'Hl=en',
      '',
      'hl=en&referrer=x',
    ]) {
      expect(reasonOf('ANDROID', `${PLAY}&${extra}`), extra).toBe('appVersions.storeUrl.queryKey');
    }
    expect(reasonOf('ANDROID', `${PLAY}&`)).toBe('appVersions.storeUrl.queryKey');
    expect(reasonOf('ANDROID', `https://play.google.com/store/apps/details?&id=${PKG}`)).toBe(
      'appVersions.storeUrl.queryKey',
    );
    expect(reasonOf('ANDROID', `${PLAY}?hl=en`)).toBe('appVersions.storeUrl.idMismatch');
    // a name without a value is the name with an empty value
    expect(reasonOf('ANDROID', `${PLAY}&hl`)).toBe('appVersions.storeUrl.langParam');
    expect(reasonOf('ANDROID', `${PLAY}&id`)).toBe('appVersions.storeUrl.duplicateParam');
  });

  it('allows hl and gl once each and only with a language or region shaped value', () => {
    expect(reasonOf('ANDROID', `${PLAY}&hl=en&hl=th`)).toBe('appVersions.storeUrl.duplicateParam');
    expect(reasonOf('ANDROID', `${PLAY}&gl=US&gl=TH`)).toBe('appVersions.storeUrl.duplicateParam');
    for (const value of [
      '',
      'e',
      'english',
      'en-',
      'en-U',
      'en-USA-X',
      'en_',
      '1a',
      'en%2DUS',
      'en US',
      'en;x',
    ]) {
      expect(reasonOf('ANDROID', `${PLAY}&hl=${value}`), `hl=${value}`).not.toBeNull();
      expect(reasonOf('ANDROID', `${PLAY}&gl=${value}`), `gl=${value}`).not.toBeNull();
    }
    expect(reasonOf('ANDROID', `${PLAY}&hl=e`)).toBe('appVersions.storeUrl.langParam');
  });

  it('does not accept percent-encoded or upper-case spellings of the parts that are compared', () => {
    expect(reasonOf('ANDROID', `https://play.google.com/store/apps/details?%69d=${PKG}`)).toBe(
      'appVersions.storeUrl.queryKey',
    );
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=com%2Eexample.avatar`),
    ).toBe('appVersions.storeUrl.idMismatch');
    expect(reasonOf('ANDROID', `https://play.google.com/%73tore/apps/details?id=${PKG}`)).toBe(
      'appVersions.storeUrl.androidPath',
    );
    expect(reasonOf('ANDROID', `https://pl%61y.google.com/store/apps/details?id=${PKG}`)).toBe(
      'reason.INVALID_HOST',
    );
    expect(reasonOf('ANDROID', `https://play.google.com/STORE/APPS/DETAILS?id=${PKG}`)).toBe(
      'appVersions.storeUrl.androidPath',
    );
  });

  it('refuses spaces, hidden characters and control characters anywhere', () => {
    expect(reasonOf('ANDROID', `${PLAY} `)).not.toBeNull();
    expect(reasonOf('ANDROID', ` ${PLAY}`)).not.toBeNull();
    expect(reasonOf('ANDROID', `${PLAY}\n`)).not.toBeNull();
    expect(reasonOf('ANDROID', `${PLAY}\t`)).not.toBeNull();
    expect(reasonOf('ANDROID', `${PLAY}${NBSP}`)).not.toBeNull();
    expect(reasonOf('ANDROID', `${PLAY}${ZERO_WIDTH}`)).not.toBeNull();
    expect(reasonOf('ANDROID', `${PLAY}&hl=en${RLO}`)).not.toBeNull();
    expect(
      reasonOf('ANDROID', `https://play.google.com${ZERO_WIDTH}/store/apps/details?id=${PKG}`),
    ).not.toBeNull();
    expect(reasonOf('ANDROID', PLAY.replace('google', `goo${ZERO_WIDTH}gle`))).not.toBeNull();
    expect(
      reasonOf('ANDROID', `https://play.google.com/store/apps/details?id=${PKG}\\`),
    ).not.toBeNull();
  });

  it('keeps the 2048 limit of the link rule', () => {
    const long = `${PLAY}&hl=en`.padEnd(2049, 'x');
    expect(validateStoreUrl('ANDROID', long, PKG).ok).toBe(false);
  });

  it('refuses a value that is not a platform', () => {
    expect(reasonOf('WEB' as 'ANDROID', PLAY)).toBe('appVersions.storeUrl.platform');
  });

  it('puts the link rule before the rules of the platform', () => {
    // http AND a wrong host: the first rule that fails is the link rule's
    expect(reasonOf('ANDROID', 'http://evil.com/x')).toBe('reason.NOT_HTTPS');
    expect(reasonOf('ANDROID', 'https://evil.com:99999999/x')).toBe('reason.INVALID_PORT');
  });
});

describe('validateStoreUrl, iOS (contract 24.2)', () => {
  const APP = 'https://apps.apple.com/th/app/avatar-chat/id1234567890';
  it('accepts the two shapes of the path', () => {
    expect(validateStoreUrl('IOS', APP)).toEqual({ ok: true });
    expect(validateStoreUrl('IOS', 'https://apps.apple.com/app/id1234567890')).toEqual({
      ok: true,
    });
    expect(validateStoreUrl('IOS', 'https://APPS.apple.com/us/app/x/id1')).toEqual({ ok: true });
    expect(
      validateStoreUrl(
        'IOS',
        'https://apps.apple.com/us/app/%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A/id99?l=th',
      ),
    ).toEqual({
      ok: true,
    });
    // the package name does not matter for iOS
    expect(validateStoreUrl('IOS', APP, 'anything')).toEqual({ ok: true });
  });

  it('refuses a link that is not https', () => {
    expect(reasonOf('IOS', APP.replace('https', 'http'))).toBe('reason.NOT_HTTPS');
    expect(reasonOf('IOS', '')).toBe('appVersions.storeUrl.empty');
  });

  it('refuses a host that is not apps.apple.com', () => {
    for (const host of [
      'apps.apple.com.evil.com',
      'itunes.apple.com',
      'apple.com',
      'app.apple.com',
      'apps.apple.com.',
      'evilapps.apple.com',
      'apps.apple.com:8443',
      'play.google.com',
    ]) {
      const reason = reasonOf('IOS', `https://${host}/th/app/avatar-chat/id1234567890`);
      expect(reason, host).not.toBeNull();
    }
    expect(reasonOf('IOS', 'https://itunes.apple.com/th/app/avatar-chat/id1234567890')).toBe(
      'appVersions.storeUrl.iosHost',
    );
    expect(reasonOf('IOS', 'https://apps.apple.com@evil.com/th/app/avatar-chat/id1234567890')).toBe(
      'reason.INVALID_HOST',
    );
  });

  it('refuses any other shape of the path', () => {
    for (const path of [
      '/',
      '',
      '/app',
      '/app/id',
      '/app/idabc',
      '/app/id12x',
      '/app/id-1',
      '/th/app/id123',
      '/thai/app/x/id123',
      '/t/app/x/id123',
      '/th/apps/x/id123',
      '/th/app/x/y/id123',
      '/th/app//id123',
      '/th/app/x/id123/',
      '/th/app/x/ID123',
      '/th/APP/x/id123',
      '/app/id123/',
      '/th/app/x/id123;x',
    ]) {
      expect(reasonOf('IOS', `https://apps.apple.com${path}`), path).toBe(
        'appVersions.storeUrl.iosPath',
      );
    }
  });

  it('does not take ASCII digits for other digits', () => {
    expect(
      reasonOf('IOS', `https://apps.apple.com/app/id${String.fromCharCode(0x0661, 0x0662)}`),
    ).not.toBeNull();
    expect(reasonOf('IOS', 'https://apps.apple.com/app/id1 ')).not.toBeNull();
  });
});

describe('validateStoreUrl and the link rule', () => {
  it('every link it accepts also passes validateServerLink', () => {
    const accepted = [
      PLAY,
      `${PLAY}&hl=en&gl=US`,
      'https://apps.apple.com/th/app/avatar-chat/id1234567890',
      'https://apps.apple.com/app/id9?l=th',
    ];
    for (const url of accepted) {
      const platform = url.includes('apple') ? 'IOS' : 'ANDROID';
      expect(validateStoreUrl(platform, url, PKG).ok, url).toBe(true);
      expect(validateServerLink(url).ok, url).toBe(true);
    }
  });

  it('every reason key is a text of both languages', () => {
    const keys = new Set<string>();
    const samples: ['ANDROID' | 'IOS', string][] = [
      ['ANDROID', ''],
      ['ANDROID', PLAY.replace('https', 'http')],
      ['ANDROID', 'https://evil.com/x'],
      ['ANDROID', `https://play.google.com:443/store/apps/details?id=${PKG}`],
      ['ANDROID', `${PLAY}#x`],
      ['ANDROID', `https://play.google.com/store/apps?id=${PKG}`],
      ['ANDROID', 'https://play.google.com/store/apps/details'],
      ['ANDROID', 'https://play.google.com/store/apps/details?id=x.y.z'],
      ['ANDROID', `${PLAY}&a=b`],
      ['ANDROID', `${PLAY}&hl=en&hl=th`],
      ['ANDROID', `${PLAY}&hl=1`],
      ['ANDROID', 'https://play.google.com/store/apps/details?id=bad'],
      ['IOS', 'https://evil.com/app/id1'],
      ['IOS', 'https://apps.apple.com/x'],
      ['ANDROID', `https://user@play.google.com/store/apps/details?id=${PKG}`],
    ];
    for (const [platform, url] of samples) {
      const check = validateStoreUrl(platform, url, PKG);
      if (!check.ok) keys.add(check.reasonKey);
    }
    const check = validateStoreUrl(
      'ANDROID',
      'https://play.google.com/store/apps/details?id=bad',
      undefined,
    );
    if (!check.ok) keys.add(check.reasonKey);
    expect(keys.size).toBeGreaterThan(10);
    for (const key of keys) {
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });
});

// ---- the randomized comparison with a second, independent statement of the rule ----

/** A tiny seeded generator, so a failure can be repeated. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `play` as `[pP][lL][aA][yY]`: a host in any case, a path in exactly one. */
const anyCase = (s: string) =>
  [...s]
    .map((c) => (/[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : escapeRegex(c)))
    .join('');

/** The Android rule written as one regular expression: every order of id, hl and gl, id always there. */
function androidPattern(pkg: string): RegExp {
  const lang = '[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?';
  const part = { id: `id=${escapeRegex(pkg)}`, hl: `hl=${lang}`, gl: `gl=${lang}` };
  const orders: string[][] = [
    ['id'],
    ['id', 'hl'],
    ['hl', 'id'],
    ['id', 'gl'],
    ['gl', 'id'],
    ['id', 'hl', 'gl'],
    ['id', 'gl', 'hl'],
    ['hl', 'id', 'gl'],
    ['gl', 'id', 'hl'],
    ['hl', 'gl', 'id'],
    ['gl', 'hl', 'id'],
  ];
  const queries = orders.map((o) => o.map((k) => part[k as keyof typeof part]).join('&'));
  return new RegExp(
    `^https://${anyCase('play.google.com')}/store/apps/details\\?(?:${queries.join('|')})$`,
  );
}

// Printable ASCII without the backslash (the link rule), and a name without `/`, `?` and `#`.
const NAME = '(?:(?![/?#\\\\])[!-~])+';
const REST = '(?:[?#](?:(?!\\\\)[!-~])*)?';
const IOS_PATTERN = new RegExp(
  `^https://${anyCase('apps.apple.com')}(?:/[A-Za-z]{2}/app/${NAME}/id[0-9]+|/app/id[0-9]+)${REST}$`,
);

const referenceAccepts = (platform: 'ANDROID' | 'IOS', url: string, pkg: string): boolean =>
  url.length <= 2048 &&
  (platform === 'ANDROID' ? androidPattern(pkg).test(url) : IOS_PATTERN.test(url));

describe('validateStoreUrl against a second statement of the rule', () => {
  const pick = <T>(rnd: () => number, list: readonly T[]): T =>
    list[Math.floor(rnd() * list.length)];

  /** The valid value most of the time (`good` of the time), one of the broken ones otherwise. */
  const slot = <T>(
    rnd: () => number,
    good: number,
    valid: readonly T[],
    broken: readonly T[],
  ): T => (rnd() < good ? pick(rnd, valid) : pick(rnd, broken));

  const androidBuilder = (rnd: () => number): string => {
    // Some samples are nearly all valid, so that the accepted ones are many; the rest are rough.
    const good = rnd() < 0.55 ? 0.985 : 0.6;
    const scheme = slot(rnd, good, ['https://'], ['http://', 'HTTPS://', ' https://', '//']);
    const userinfo = slot(rnd, good, [''], ['u@', 'play.google.com@']);
    const host = slot(
      rnd,
      good,
      ['play.google.com', 'PLAY.GOOGLE.COM', 'Play.Google.Com'],
      [
        'play.google.com.',
        'play.google.com.evil.com',
        'xplay.google.com',
        'play.google.co',
        'play-google.com',
        'play.google.com:443',
        'play.google.com:',
        `pl${CYRILLIC_A}y.google.com`,
      ],
    );
    const path = slot(
      rnd,
      good,
      ['/store/apps/details'],
      [
        '/store/apps/details/',
        '/Store/apps/details',
        '/store/apps/detail',
        '/store/apps',
        '/store//apps/details',
        '/store/apps/details%20',
      ],
    );
    const pieces: string[] = [];
    const idPiece = slot(
      rnd,
      good,
      [`id=${PKG}`],
      [
        `id=${PKG.toUpperCase()}`,
        `id=${PKG}.x`,
        'id=',
        'id',
        'ID=com.example.avatar',
        'id=com%2Eexample.avatar',
        '%69d=com.example.avatar',
      ],
    );
    pieces.push(idPiece);
    if (rnd() < 0.5) {
      pieces.push(
        slot(
          rnd,
          good,
          ['hl=en', 'hl=th', 'hl=pt-BR', 'hl=zh_Hans', 'hl=zh-Hans', 'hl=es-419'],
          ['hl=e', 'hl=', 'hl=english', 'hl=en-', 'hl=en%2DUS', 'HL=en'],
        ),
      );
    }
    if (rnd() < 0.5) {
      pieces.push(
        slot(rnd, good, ['gl=US', 'gl=th', 'gl=ID'], ['gl=U', 'gl=', 'gl=USAA', 'gl=us-x']),
      );
    }
    if (rnd() < 0.12)
      pieces.push(pick(rnd, ['referrer=x', 'utm_source=a', 'hl=en', `id=${PKG}`, '', 'x']));
    if (rnd() < 0.04) pieces.splice(Math.floor(rnd() * pieces.length), 1);
    // shuffle most of the time
    if (rnd() < 0.8) {
      for (let i = pieces.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rnd() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
    }
    const joiner = slot(rnd, good, ['&'], [';', '&&', '?', '&amp;']);
    const query = pieces.length === 0 && rnd() < 0.5 ? '' : `?${pieces.join(joiner)}`;
    const tail = slot(rnd, good, [''], ['#', '#frag', ' ', '\n', '&', String.fromCharCode(0x200b)]);
    return `${scheme}${userinfo}${host}${path}${query}${tail}`;
  };

  const iosBuilder = (rnd: () => number): string => {
    const good = rnd() < 0.55 ? 0.985 : 0.6;
    const scheme = slot(rnd, good, ['https://'], ['http://']);
    const host = slot(
      rnd,
      good,
      ['apps.apple.com', 'APPS.APPLE.COM'],
      ['itunes.apple.com', 'apps.apple.com.evil.com', 'apps.apple.com:8443', 'apps.apple.com.'],
    );
    const path = slot(
      rnd,
      good,
      [
        '/th/app/avatar-chat/id1234567890',
        '/app/id42',
        '/us/app/x/id1',
        '/th/app/%E0%B8%81/id7',
        '/ar/app/_a.b~c+d/id99',
      ],
      [
        '/us/app/id1',
        '/usa/app/x/id1',
        '/th/app/x/y/id1',
        '/th/app/x/id',
        '/th/app/x/id1x',
        '/th/app/x/ID1',
        '/app/id',
        '/app/id1/',
        '/th/app/ก/id7',
        '/th/app/a b/id7',
      ],
    );
    const tail = slot(rnd, good, ['', '?l=th', '?mt=8&l=en', '#x'], [' ', '?a b']);
    return `${scheme}${host}${path}${tail}`;
  };

  it('agrees on 30000 generated Android links, and the sample holds both answers often', () => {
    const rnd = random(0xa11ce);
    let accepted = 0;
    for (let i = 0; i < 30000; i += 1) {
      const url = androidBuilder(rnd);
      const mine = validateStoreUrl('ANDROID', url, PKG).ok;
      expect(mine, url).toBe(referenceAccepts('ANDROID', url, PKG));
      if (mine) accepted += 1;
    }
    expect(accepted).toBeGreaterThan(1000);
    expect(accepted).toBeLessThan(25000);
  });

  it('agrees on 20000 generated iOS links, and the sample holds both answers often', () => {
    const rnd = random(0xb0b);
    let accepted = 0;
    for (let i = 0; i < 20000; i += 1) {
      const url = iosBuilder(rnd);
      const mine = validateStoreUrl('IOS', url).ok;
      expect(mine, url).toBe(referenceAccepts('IOS', url, ''));
      if (mine) accepted += 1;
    }
    expect(accepted).toBeGreaterThan(1000);
    expect(accepted).toBeLessThan(15000);
  });

  it('agrees on links made of random characters around a valid core', () => {
    const rnd = random(0xc0ffee);
    const alphabet = [
      'a',
      'Z',
      '0',
      '.',
      '/',
      '?',
      '&',
      '=',
      '#',
      '%',
      ':',
      '@',
      '-',
      '_',
      ' ',
      '\\',
      '~',
    ];
    for (let i = 0; i < 20000; i += 1) {
      const chars = [...PLAY];
      const edits = 1 + Math.floor(rnd() * 3);
      for (let e = 0; e < edits; e += 1) {
        const at = Math.floor(rnd() * chars.length);
        const roll = rnd();
        if (roll < 0.34) chars.splice(at, 1);
        else if (roll < 0.67) chars.splice(at, 0, pick(rnd, alphabet));
        else chars[at] = pick(rnd, alphabet);
      }
      const url = chars.join('');
      expect(validateStoreUrl('ANDROID', url, PKG).ok, url).toBe(
        referenceAccepts('ANDROID', url, PKG),
      );
    }
  });

  it('never accepts what validateServerLink refuses', () => {
    const rnd = random(0xfeed);
    for (let i = 0; i < 20000; i += 1) {
      const url = androidBuilder(rnd);
      if (validateStoreUrl('ANDROID', url, PKG).ok)
        expect(validateServerLink(url).ok, url).toBe(true);
    }
  });
});
