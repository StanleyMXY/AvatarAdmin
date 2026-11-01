import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type AllowEntry,
  applyAllowList,
  type Finding,
  isPresent,
  isTextFile,
  type PatternRule,
  readAllowList,
  repoFiles,
  scanPatterns,
  scanSource,
} from './noHardcodedText.scan';

/**
 * The sources that can show text to a person: components and the helpers beside them. Not the tests
 * and their set-ups, the generated files, nor the request layer, whose `message` is the developer's
 * description of a failure: what is shown is the text of the error code, from the language files.
 */
const isScannedSource = (f: string) =>
  /^src\/.*\.tsx?$/.test(f) &&
  !/\.(test|generated)\.tsx?$|\.d\.ts$|(^|\/)testSetup\.ts$|^src\/request\//.test(f) &&
  isPresent(f);

const show = (findings: Finding[]) =>
  findings.map((f) => `${f.file}:${f.line}  ${f.text}`).join('\n');

describe('scanSource: text in .tsx that does not come from a language file', () => {
  const scan = (code: string) => scanSource('fixture.tsx', code);

  it('finds text in JSX, in English, Chinese, Thai and Arabic', () => {
    for (const text of ['Save', '保存', 'บันทึก', 'حفظ', 'Guardar cambios']) {
      expect(scan(`export const A = () => <div>${text}</div>;`).map((f) => f.text)).toEqual([text]);
    }
  });

  it('finds text in the props that people read', () => {
    const code = `export const A = () => <Modal title="Delete" okText='确定' placeholder={'Search'} label={ok ? 'Yes' : 'No'} />;`;
    expect(
      scan(code)
        .map((f) => f.text)
        .sort(),
    ).toEqual(['Delete', 'No', 'Search', 'Yes', '确定'].sort());
  });

  it('finds a string in braces between tags, and a default message that would bypass the language files', () => {
    expect(scan(`export const A = () => <b>{'Hello'}</b>;`)).toHaveLength(1);
    expect(
      scan(`export const A = () => intl.formatMessage({ id: 'x', defaultMessage: 'Save it' });`),
    ).toHaveLength(1);
  });

  it('finds text given to a notice or a dialog through a variable of any name: api.error(...), modal.confirm(...)', () => {
    const code = `export const A = () => { api.error('Could not save'); modal.warning('Careful'); notice.info('Done'); api.success('已保存'); };`;
    expect(scan(code).map((f) => f.text)).toEqual(['Could not save', 'Careful', 'Done', '已保存']);
    // ... and not what merely shares the name of the method
    expect(scan(`export const A = () => { logger.error(err); api.open({ key: 'x' }); };`)).toEqual(
      [],
    );
  });

  it('reads a .ts file as TypeScript (a generic is not a tag) and finds the text a helper would show', () => {
    const code = `export const pick = <T,>(x: T) => x;\nexport const columns = [{ title: 'Name', dataIndex: 'name' }];`;
    expect(scanSource('helper.ts', code).map((f) => f.text)).toEqual(['Name']);
  });

  it('reports the line', () => {
    expect(
      scan(`const a = 1;\n\nexport const A = () => (\n  <p>\n    Oops\n  </p>\n);`)[0].line,
    ).toBe(5);
  });

  it('passes text from the language file', () => {
    const code = `export const A = () => <div title={intl.formatMessage({ id: 'a.b' })}><FormattedMessage id="c.d" />{intl.formatMessage({ id: 'e.f' })}</div>;`;
    expect(scan(code)).toEqual([]);
  });

  it('passes what is not text: numbers, symbols, punctuation, class names, test ids, keys, urls in non-text props', () => {
    const code = `export const A = () => <div className="card big" data-testid="box" key="k1" id="main" type="primary" href="/users/list">— / · % 12 {'%'} {count}</div>;`;
    expect(scan(code)).toEqual([]);
  });

  it('does not take a plain object or a string outside JSX for a text', () => {
    expect(scan(`const messages = { 'a.b': 'Hello' }; const x = 'Hello world';`)).toEqual([]);
  });

  it('does not crash on a template with a part that is computed, and finds the text around it', () => {
    // Written without a literal placeholder so that the linter does not take the fixtures for mistakes.
    const n = '$' + '{n}';
    const id = '$' + '{id}';
    const tpl = (inner: string) => `\`${inner}\``;
    expect(
      scan(`export const A = () => <b>{${tpl(`Total ${n}`)}}</b>;`).map((f) => f.text),
    ).toEqual(['Total']);
    expect(
      scan(`export const A = () => <Tag title={${tpl(`Selected ${n}`)}} />;`).map((f) => f.text),
    ).toEqual(['Selected']);
    expect(
      scan(`export const A = () => <b>{${tpl(`${n} items`)}}</b>;`).map((f) => f.text),
    ).toEqual(['items']);
    expect(
      scan(`export const A = () => <b title={${tpl(`user-${id}`)}} />;`).map((f) => f.text),
    ).toEqual(['user-']);
    expect(scan(`export const A = () => <b title={${tpl(`${n}%`)}} />;`)).toEqual([]);
  });

  it('finds text in the objects that build a table, a menu, a dialog or a form', () => {
    const code = [
      "export const columns = [{ title: 'Name', dataIndex: 'name' }];",
      "export const options = [{ label: 'Yes', value: 1 }];",
      "export const items = [{ key: 'a', label: '保存' }];",
      "export const valueEnum = { a: { text: 'Active' } };",
      "export const A = () => { Modal.confirm({ title: 'Delete?', content: 'Are you sure' }); return null; };",
    ].join('\n');
    expect(
      scan(code)
        .map((f) => f.text)
        .sort(),
    ).toEqual(['Active', 'Are you sure', 'Delete?', 'Name', 'Yes', '保存'].sort());
  });

  it('finds the text given to message and notification calls', () => {
    const code =
      "export const A = () => { message.error('Save failed'); notification.open({ message: 'Done', description: 'All saved' }); return null; };";
    expect(
      scan(code)
        .map((f) => f.text)
        .sort(),
    ).toEqual(['All saved', 'Done', 'Save failed']);
  });

  it('finds text in the props of inputs and switches, and through String(), as and parentheses', () => {
    const code =
      "export const A = () => <><Input addonBefore=\"Price\" suffix={'kg'} /><Switch checkedChildren=\"On\" unCheckedChildren={('Off' as string)} /><Card subTitle={String('Hello')} /></>;";
    expect(
      scan(code)
        .map((f) => f.text)
        .sort(),
    ).toEqual(['Hello', 'Off', 'On', 'Price', 'kg'].sort());
  });

  it('does not take other keys of an object for text', () => {
    expect(
      scan(
        "export const x = { key: 'name', dataIndex: 'name', value: 'active', type: 'primary' };",
      ),
    ).toEqual([]);
  });

  it('passes text that is only an expression', () => {
    expect(scan('export const A = () => <div>{name}</div>;')).toEqual([]);
  });
});

describe('which files are read', () => {
  it('leaves out a file that git lists but that no longer exists', () => {
    expect(isPresent('package.json')).toBe(true);
    expect(isPresent('src/pages/does-not-exist.tsx')).toBe(false);
  });

  it('reads dot files and the hook scripts, not the lock file', () => {
    expect(isTextFile('.npmrc')).toBe(true);
    expect(isTextFile('.lintstagedrc')).toBe(true);
    expect(isTextFile('.husky/pre-commit')).toBe(true);
    expect(isTextFile('src/app.tsx')).toBe(true);
    expect(isTextFile('package-lock.json')).toBe(false);
    expect(isTextFile('public/logo.png')).toBe(false);
  });

  it('reads the shared allow list and the one beside each module, and no other json', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'allow-'));
    mkdirSync(join(dir, 'pages'));
    const entry = (text: string) => [{ file: 'x.tsx', text, reason: 'r' }];
    const module = join(dir, 'pages', 'hardcodedText.allow.json');
    const other = join(dir, 'pages', 'other.json');
    writeFileSync(module, JSON.stringify(entry('module')));
    writeFileSync(other, JSON.stringify(entry('other')));
    const texts = readAllowList(['tests/noHardcodedText.allow.json', module, other]).map(
      (e) => e.text,
    );
    expect(texts).toContain('module');
    expect(texts).not.toContain('other');
    expect(texts.filter((t) => t === 'module')).toHaveLength(1);
  });
});

describe('applyAllowList', () => {
  const finding: Finding = { file: 'src/a.tsx', line: 3, text: 'Hello' };
  const allow: AllowEntry = { file: 'src/a.tsx', text: 'Hello', reason: 'brand name shown as is' };

  it('removes the findings that are listed', () => {
    expect(applyAllowList([finding], [allow])).toEqual({ remaining: [], unused: [] });
  });

  it('keeps the others, and reports an entry that matches nothing, so the list cannot go stale', () => {
    const result = applyAllowList([finding], [{ ...allow, text: 'Bye' }]);
    expect(result.remaining).toEqual([finding]);
    expect(result.unused).toHaveLength(1);
  });
});

describe('the repository today', () => {
  const files = repoFiles();
  const allow: AllowEntry[] = readAllowList(files);

  it('has a reason for every allowed text', () => {
    for (const entry of allow) {
      expect(entry.file && entry.text && entry.reason?.trim(), JSON.stringify(entry)).toBeTruthy();
    }
  });

  it('has no text in src/**/*.tsx or *.ts that skips the language files, except what is allowed', () => {
    const found = files
      .filter(isScannedSource)
      .flatMap((f) => scanSource(f, readFileSync(f, 'utf8')));
    const { remaining, unused } = applyAllowList(found, allow);
    expect(show(remaining)).toBe('');
    expect(unused).toEqual([]);
  });
});

// The words are written in two halves so that this file does not contain them itself.
const FORBIDDEN_NAMES = ['dra' + 'mabox', 'dra' + 'maverse'];
const isDocs = (f: string) => f.startsWith('docs/');
const isTestSupport = (f: string) =>
  /\.test\./.test(f) || f.startsWith('mock/') || f.startsWith('tests/') || isDocs(f);

const RULES: PatternRule[] = [
  { name: 'fixed token', pattern: new RegExp(`token${'='}123`), skip: isDocs },
  { name: 'hashing in the browser', pattern: new RegExp(`m${'d'}5`, 'i'), skip: isDocs },
  {
    name: 'a call that hashes in the browser',
    // A function that hashes (sha256(...), bcrypt(...)), the browser's digest, or a library for it. A
    // mention in a text (the SHA-256 of a file the server computed) is not a hash made here.
    pattern:
      /\b(?:sha-?(?:1|224|256|384|512)|sha3|bcrypt|scrypt|argon2(?:id|i|d)?|pbkdf2)(?:\.\w+)?\s*\(|\bcreateHash\b|crypto\.subtle|subtle\.digest|crypto-js|js-sha\d*|bcryptjs|sha\.js|hash-wasm/i,
    // The fake backend and the tests compute checksums of their own data; the browser code must not hash a password.
    skip: (f) => isTestSupport(f) || !f.startsWith('src/'),
  },
  { name: 'public CDN address', pattern: new RegExp(`\\bcd${'n'}\\.`, 'i'), skip: isDocs },
  {
    name: 'external address',
    pattern:
      /(?:https?|wss?):\/\/(?!localhost\b|127\.0\.0\.1\b|www\.w3\.org\/|example\.(?:com|org|net)\b)(?:[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})/,
    skip: isTestSupport,
    skipLine: /"\$schema"/,
  },
  {
    name: 'external address without a scheme (//host)',
    pattern:
      /["'`(=]\/\/(?!localhost\b|example\.(?:com|org|net)\b)[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z]{2,}/,
    skip: isTestSupport,
  },
  {
    name: 'name of another project',
    pattern: new RegExp(FORBIDDEN_NAMES.join('|'), 'i'),
    skip: isDocs,
  },
  {
    name: 'hidden, direction-control or non-ASCII space character',
    // Format characters (zero-width, direction marks, BOM, soft hyphen, Arabic number signs), line and
    // paragraph separators, the Hangul filler, and every space other than the plain one.
    pattern: /[\p{Cf}\u0085\u2028\u2029\u3164\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u,
    skip: isDocs,
  },
  {
    name: 'Korean text',
    pattern: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/,
    skip: () => false,
  },
];

describe('the whole repository (outside node_modules, dist, generated files and docs for most rules)', () => {
  const files = repoFiles();

  for (const rule of RULES) {
    it(`has no ${rule.name}`, () => {
      expect(show(scanPatterns(files, [rule]))).toBe('');
    });
  }

  it('looks at the files of the repository, not at none', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('package.json');
    expect(files.some((f) => f.startsWith('node_modules/'))).toBe(false);
  });
});

describe('scanPatterns finds what it should (on a temporary fixture)', () => {
  it('reports each rule on a file that breaks it', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'scan-'));
    mkdirSync(join(dir, 'src'));
    const file = join(dir, 'src', 'bad.ts');
    const bad = [
      `const a = 'https://assets.some-site.io/logo.png';`,
      `const b = "token${'='}123";`,
      `const c = hash${'M'}${'D'}5(password);`,
      `const d = '${'dra' + 'mabox'}';`,
      `const e = 'https://fonts.cd${'n'}.example.org/f.css';`,
      `const f = '${String.fromCharCode(0x200b)}';`,
      `const h = '${String.fromCharCode(0x3000)}';`,
      `const g = '${String.fromCharCode(0xc548, 0xb155)}';`,
      `const i = crypto.subtle.digest('SHA-256', bytes);`,
      `const j = '//assets.some-site.io/logo.png';`,
    ].join('\n');
    writeFileSync(file, bad);
    const names = scanPatterns(
      [file],
      RULES.map((r) => ({ ...r, skip: () => false })),
    ).map((f) => f.text.split(':')[0]);
    expect(new Set(names)).toEqual(new Set(RULES.map((r) => r.name)));
  });

  it('reports each hidden or non-ASCII space character on its own', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const rule = RULES.find((r) => r.name.startsWith('hidden')) as PatternRule;
    const dir = mkdtempSync(join(tmpdir(), 'hidden-'));
    const codes = [
      0x200b, 0x200f, 0x202e, 0xfeff, 0x00ad, 0x0600, 0x061c, 0x00a0, 0x2003, 0x3000, 0x0085,
      0x2028, 0x3164,
    ];
    const file = join(dir, 'chars.ts');
    writeFileSync(file, codes.map((c) => `const x = '${String.fromCharCode(c)}';`).join('\n'));
    const found = scanPatterns([file], [{ ...rule, skip: () => false }]);
    expect(found.map((f) => f.line)).toEqual(codes.map((_, i) => i + 1));
    writeFileSync(file, "const x = 'plain text, ก็ مرحبا 你好';\nconst y = '\\u200b';");
    expect(scanPatterns([file], [{ ...rule, skip: () => false }])).toEqual([]);
  });

  it('finds the other ways to hash and the address without a scheme, and passes mentions, comments and the example domains', () => {
    const find = (name: string) => RULES.find((r) => r.name.startsWith(name)) as PatternRule;
    const hashing = find('a call that hashes');
    for (const bad of [
      'await crypto.subtle.digest("SHA-256", data)',
      "import { createHash } from 'node:crypto'",
      'sha1(password)',
      'sha-512 (x)',
      'bcrypt.hash(password)',
      'argon2id(password)',
      'pbkdf2(',
      "import sha from 'js-sha256'",
      "import CryptoJS from 'crypto-js'",
    ]) {
      expect(hashing.pattern.test(bad), bad).toBe(true);
    }
    for (const ok of [
      'const shared = 1',
      'a sha is a commit',
      'sha: string',
      'this.sha256Of',
      "'SHA-256 {sha}'",
      'createHashHistory()',
      'row.sha256',
    ]) {
      expect(hashing.pattern.test(ok), ok).toBe(false);
    }
    const bare = find('external address without a scheme');
    for (const bad of [
      `'//cd${'n'}.some-site.io/x.js'`,
      'src="//assets.some-site.io/a.png"',
      'url(//a.io/b)',
    ]) {
      expect(bare.pattern.test(bad), bad).toBe(true);
    }
    for (const ok of [
      '// a comment about example.org',
      "x = 'https://a.io'",
      "'//example.com/a'",
      "'//localhost/a'",
      '`a//b`',
      "path.split('//')",
    ]) {
      expect(bare.pattern.test(ok), ok).toBe(false);
    }
  });

  it('lets a local address, an XML namespace and the example domains through', () => {
    const external = RULES.find((r) => r.name === 'external address') as PatternRule;
    for (const ok of [
      'http://localhost:8000/x',
      'http://127.0.0.1:8080',
      'xmlns="http://www.w3.org/2000/svg"',
      'https://example.com/a',
      'https://',
    ]) {
      expect(external.pattern.test(ok), ok).toBe(false);
    }
    expect(external.pattern.test(`https://cd${'n'}.jsdelivr.net/npm/x`)).toBe(true);
    for (const bad of [
      'http://10.0.0.5/x',
      'ws://evil.io/socket',
      'wss://203.0.113.9:8443',
      'http://127.0.0.10/',
    ]) {
      expect(external.pattern.test(bad), bad).toBe(true);
    }
    expect(external.pattern.test('ws://localhost:8000/ws')).toBe(false);
  });
});
