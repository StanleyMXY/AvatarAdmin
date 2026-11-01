import { describe, expect, it } from 'vitest';
import { describeLink } from './displayText';
import { DASH } from './ratio';

const MESSAGES: Record<string, string> = {
  'pages.link.type.NONE': 'No link',
  'pages.link.type.SCREEN': 'App screen',
  'pages.link.type.URL': 'Web address',
  'pages.link.screen.store': 'Store',
};
const intl = {
  messages: { ...MESSAGES, 'push.link.summary': '', 'notifications.link.summary': '' },
  // The two summary texts join differently here, so that a test sees which one was asked for.
  formatMessage: ({ id }: { id: string }, values?: Record<string, string | number>) => {
    if (id === 'push.link.summary') return `${values?.kind}: ${values?.target}`;
    if (id === 'notifications.link.summary') return `${values?.kind} / ${values?.target}`;
    return MESSAGES[id] ?? id;
  },
};

const URL_THAI = 'https://example.com/ไทย?q=مرحبا';

// The options each page passes (src/pages/push/templates.tsx, src/pages/notifications/NotificationDrawer.tsx).
type Intl = Parameters<typeof describeLink>[0];
const describePushLink = (i: Intl, type: unknown, target: unknown) =>
  describeLink(i, type, target, { summaryId: 'push.link.summary', empty: '' });
const describeNotificationLink = (i: Intl, type: unknown, target: unknown) =>
  describeLink(i, type, target, {
    summaryId: 'notifications.link.summary',
    empty: DASH,
    writeOut: true,
  });

// The two pages say the same thing; they differ in what a link type that is not text becomes.
const describers = [
  {
    name: 'push',
    join: ': ',
    describe: (type: unknown, target: unknown) => describePushLink(intl, type, target),
  },
  {
    name: 'notifications',
    join: ' / ',
    describe: (type: unknown, target: unknown) => describeNotificationLink(intl, type, target),
  },
];

describe.each(describers)('the one-line description of a link ($name)', ({ describe: d, join }) => {
  it.each([
    ['NONE', 'ignored', 'No link'],
    ['URL', URL_THAI, `Web address${join}${URL_THAI}`],
    ['SCREEN', 'store', `App screen${join}Store`],
    ['SCREEN', 'a_new_screen', `App screen${join}a_new_screen`],
    ['URL', '', 'Web address'],
    ['URL', null, 'Web address'],
    ['URL', undefined, 'Web address'],
    ['SCREEN', 5, `App screen${join}5`],
    ['URL', { a: 1 }, `Web address${join}{"a":1}`],
    ['NEW_KIND', 'x', `NEW_KIND${join}x`],
  ])('%s with %j reads "%s"', (type, target, expected) => {
    expect(d(type, target)).toBe(expected);
  });
});

describe('what a link type that is empty or not text becomes', () => {
  it('push: an empty text, whatever is not text', () => {
    for (const type of [undefined, null, '', 5, { a: 1 }])
      expect(describePushLink(intl, type, 'x')).toBe('');
  });
  it('notifications: a dash for nothing, the type written out for a number or an object', () => {
    for (const type of [undefined, null, ''])
      expect(describeNotificationLink(intl, type, 'x')).toBe(DASH);
    expect(describeNotificationLink(intl, 5, 'x')).toBe('5 / x');
    expect(describeNotificationLink(intl, { a: 1 }, 'x')).toBe('{"a":1} / x');
  });
});
