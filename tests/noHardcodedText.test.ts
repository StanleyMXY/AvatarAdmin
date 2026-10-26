import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type AllowEntry,
  applyAllowList,
  type Finding,
  type PatternRule,
  repoFiles,
  scanPatterns,
  scanSource,
} from './noHardcodedText.scan';

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

  it('passes text that is only an expression', () => {
    expect(scan('export const A = () => <div>{name}</div>;')).toEqual([]);
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
  const allow = JSON.parse(
    readFileSync('tests/noHardcodedText.allow.json', 'utf8'),
  ) as AllowEntry[];

  it('has a reason for every allowed text', () => {
    for (const entry of allow) {
      expect(entry.file && entry.text && entry.reason?.trim(), JSON.stringify(entry)).toBeTruthy();
    }
  });

  it('has no text in src/**/*.tsx that skips the language files, except what is allowed', () => {
    const found = files
      .filter((f) => /^src\/.*\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))
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
  { name: 'public CDN address', pattern: new RegExp(`\\bcd${'n'}\\.`, 'i'), skip: isDocs },
  {
    name: 'external address',
    pattern:
      /https?:\/\/(?!localhost\b|127\.0\.0\.1\b|www\.w3\.org\/|example\.(?:com|org|net)\b)[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
    skip: isTestSupport,
    skipLine: /"\$schema"/,
  },
  {
    name: 'name of another project',
    pattern: new RegExp(FORBIDDEN_NAMES.join('|'), 'i'),
    skip: isDocs,
  },
  {
    name: 'hidden or direction-control character',
    pattern: /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\u00ad]/,
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
      `const g = '${String.fromCharCode(0xc548, 0xb155)}';`,
    ].join('\n');
    writeFileSync(file, bad);
    const names = scanPatterns(
      [file],
      RULES.map((r) => ({ ...r, skip: () => false })),
    ).map((f) => f.text.split(':')[0]);
    expect(new Set(names)).toEqual(new Set(RULES.map((r) => r.name)));
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
  });
});
