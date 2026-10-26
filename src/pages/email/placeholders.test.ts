import { describe, expect, it } from 'vitest';
import { listOfText, missingPlaceholders } from './placeholders';

describe('the required placeholders of a template body', () => {
  it('finds {code} when the body has it exactly', () => {
    expect(missingPlaceholders('Your code is {code}.', ['{code}'])).toEqual([]);
    expect(missingPlaceholders('{code}', ['{code}'])).toEqual([]);
  });

  it('does not find it as the bare word, in capitals, or with spaces inside the braces, and names it', () => {
    expect(missingPlaceholders('Your code is code.', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('Your code is {CODE}.', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('Your code is { code }.', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('Your code is {Code}.', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('Your code is {code', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('Your code is code}', ['{code}'])).toEqual(['{code}']);
    expect(missingPlaceholders('', ['{code}'])).toEqual(['{code}']);
  });

  it('names every missing one, in the order of the list, and not the ones that are there', () => {
    expect(
      missingPlaceholders('Open {confirmLink} now', ['{confirmLink}', '{subscriptionNotice}']),
    ).toEqual(['{subscriptionNotice}']);
    expect(missingPlaceholders('nothing', ['{confirmLink}', '{subscriptionNotice}'])).toEqual([
      '{confirmLink}',
      '{subscriptionNotice}',
    ]);
  });

  it('compares the string the backend gave, whatever it is: no braces added or removed, no folding of case', () => {
    expect(missingPlaceholders('a {y} b', ['x'])).toEqual(['x']);
    expect(missingPlaceholders('a x b', ['x'])).toEqual([]);
    expect(missingPlaceholders('{ÄÖ}', ['{äö}'])).toEqual(['{äö}']);
    expect(missingPlaceholders('{เวลา} {وقت} 😀{id}', ['{เวลา}', '{وقت}', '{id}'])).toEqual([]);
  });

  it('has nothing to check when the list is not a list of text', () => {
    expect(missingPlaceholders('x', undefined)).toEqual([]);
    expect(missingPlaceholders('x', null)).toEqual([]);
    expect(missingPlaceholders('x', 'x' as unknown)).toEqual([]);
    expect(missingPlaceholders('x', [1, null, {}, '{y}'] as unknown)).toEqual(['{y}']);
  });
});

describe('listOfText', () => {
  it('keeps the entries that are text and drops the rest', () => {
    expect(listOfText(['{a}', 3, null, '{b}'])).toEqual(['{a}', '{b}']);
    expect(listOfText('{a}')).toEqual([]);
    expect(listOfText(undefined)).toEqual([]);
    expect(listOfText({ 0: '{a}' })).toEqual([]);
  });
});
