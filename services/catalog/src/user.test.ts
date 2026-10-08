import { describe, expect, it } from 'vitest';
import { authorized } from './test/fixtures';
import { isAdmin, parseGroups, userFromEvent } from './user';

describe('parseGroups', () => {
  it.each([
    [['admins'], ['admins']],
    ['[admins]', ['admins']],
    ['[admins editors]', ['admins', 'editors']],
    ['admins,editors', ['admins', 'editors']],
    [undefined, []],
    [42, []],
  ])('parses %j', (value, expected) => {
    expect(parseGroups(value)).toEqual(expected);
  });
});

describe('userFromEvent', () => {
  it('takes the user id from the sub claim', () => {
    expect(userFromEvent(authorized('user-1').event)).toEqual({ id: 'user-1', groups: [] });
  });

  it('reads the groups', () => {
    const user = userFromEvent(authorized('user-1', '[admins]').event);
    expect(user && isAdmin(user)).toBe(true);
  });

  it('returns nothing without verified claims', () => {
    expect(userFromEvent(undefined)).toBeUndefined();
    expect(userFromEvent({ requestContext: {} })).toBeUndefined();
    expect(
      userFromEvent({ requestContext: { authorizer: { jwt: { claims: {} } } } }),
    ).toBeUndefined();
  });
});
