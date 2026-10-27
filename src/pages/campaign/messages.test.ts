import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US/campaign';
import zhCN from '../../locales/zh-CN/campaign';

// react-intl writes a message that does not parse to the console and shows its source, so a broken
// message is not seen by a test that renders a page: the braces of an example are the usual cause.
describe('the texts of the campaign module', () => {
  for (const [name, messages, locale] of [
    ['en-US', enUS, 'en-US'],
    ['zh-CN', zhCN, 'zh-CN'],
  ] as const) {
    it(`${name}: every message is a valid message and can be filled in`, () => {
      for (const [key, text] of Object.entries(messages)) {
        // a value for every blank of the message
        const values = Object.fromEntries(
          [...text.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], 'x']),
        );
        let formatted: unknown;
        expect(() => {
          formatted = new IntlMessageFormat(text, locale).format(values);
        }, key).not.toThrow();
        expect(typeof formatted, key).toBe('string');
      }
    });
  }

  it('shows the JSON example of the batch box with its braces', () => {
    const text = new IntlMessageFormat(enUS['campaign.batch.json.placeholder'], 'en-US').format();
    expect(text).toMatch(/^\[\{"campaignCode": "spring_th".*\}\]$/);
  });
});
