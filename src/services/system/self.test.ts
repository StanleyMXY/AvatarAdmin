import { describe, expect, it } from 'vitest';
import { isOwnAccount } from './self';

describe('isOwnAccount', () => {
  it('compares the account ids', () => {
    expect(isOwnAccount({ id: '7', username: 'a' }, { id: '7', username: 'b' })).toBe(true);
    expect(isOwnAccount({ id: '7', username: 'a' }, { id: '8', username: 'a' })).toBe(false);
  });

  it('knows its own row when the row id is a number and the signed-in id is text (or the other way round)', () => {
    expect(isOwnAccount({ id: '7' }, { id: 7 as unknown as string })).toBe(true);
    expect(isOwnAccount({ id: 7 as unknown as string }, { id: '7' })).toBe(true);
    expect(isOwnAccount({ id: '7' }, { id: 8 as unknown as string })).toBe(false);
  });

  it('falls back to the user names, ignoring case, when an id is missing', () => {
    expect(isOwnAccount({ username: 'Ploy' }, { id: '9', username: 'ploy' })).toBe(true);
    expect(isOwnAccount({ id: '7' }, { username: 'x' })).toBe(false);
  });

  it('knows its own row by the user name when the row has no id, although the signed-in account has one', () => {
    expect(isOwnAccount({ id: '7', username: 'Root' }, { username: 'root' })).toBe(true);
    expect(isOwnAccount({ id: '7', username: 'Root' }, { username: 'other' })).toBe(false);
  });

  it('counts every row as the own one when nothing is known about the signed-in administrator', () => {
    expect(isOwnAccount(undefined, { id: '1', username: 'x' })).toBe(true);
    expect(isOwnAccount({}, { id: '1' })).toBe(true);
  });
});
