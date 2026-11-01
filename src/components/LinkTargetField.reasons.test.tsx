import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { type LinkTargetValue, linkTargetRule } from './LinkTargetField';

// A link that breaks the rule says WHICH part of the rule it breaks: the words of the form are the
// reason text of that code, so a form cannot name the wrong fault (the key is `reason.<code>`).
const url = (linkTarget: string): LinkTargetValue => ({ linkType: 'URL', linkTarget });

const CASES: [string, string, string][] = [
  ['NOT_HTTPS', 'http://example.com/a', 'the scheme'],
  ['INVALID_HOST', 'https://user@example.com/a', 'a user name in the address'],
  ['INVALID_HOST', 'https://exa mple.com/a', 'a space in the host'],
  ['INVALID_PORT', 'https://example.com:99999x/a', 'a port that is not digits'],
  ['INVALID_PATH', 'https://example.com/a b', 'a space in the path'],
  ['INVALID_PATH', 'https://example.com/ü', 'a letter outside ASCII in the path'],
  ['TOO_LONG', `https://example.com/${'a'.repeat(2048)}`, 'more than 2048 characters'],
];

describe.each([
  ['English', enUS],
  ['Chinese', zhCN],
] as const)('linkTargetRule names the fault of the link in %s', (_name, messages) => {
  const rule = linkTargetRule({
    formatMessage: ({ id }) => (messages as Record<string, string>)[id],
  });
  it.each(CASES)('%s: %s (%s)', async (code, link) => {
    const expected = (messages as Record<string, string>)[`reason.${code}`];
    expect(expected).toBeTruthy();
    await expect(rule.validator({}, url(link))).rejects.toThrow(expected);
  });

  it('gives each of the five faults a text of its own', () => {
    const texts = new Set(
      ['NOT_HTTPS', 'INVALID_HOST', 'INVALID_PORT', 'INVALID_PATH', 'TOO_LONG'].map(
        (code) => (messages as Record<string, string>)[`reason.${code}`],
      ),
    );
    expect(texts.size).toBe(5);
  });
});
