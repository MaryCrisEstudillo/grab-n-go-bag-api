import { describe, expect, it } from 'vitest';
import { matchPath } from './router';

describe('path matching', () => {
  it('matches a literal path', () => {
    expect(matchPath('/bag/items', '/bag/items')).toEqual({});
  });

  it('captures a parameter', () => {
    expect(matchPath('/bag/items/:id', '/bag/items/abc-123')).toEqual({
      id: 'abc-123',
    });
  });

  it('captures a parameter with something after it', () => {
    expect(matchPath('/bag/categories/:id/items', '/bag/categories/c1/items')).toEqual(
      { id: 'c1' },
    );
  });

  /**
   * The pair most likely to be confused for each other. `/bag/items/:id` and
   * `/bag/items/:id/quantity` differ only in length, so a matcher that ignored
   * segment count would route a quantity update to the general update — which
   * would then reject the body as having nothing to change.
   */
  it('does not let a longer path match a shorter pattern', () => {
    expect(matchPath('/bag/items/:id', '/bag/items/abc/quantity')).toBeNull();
  });

  it('does not let a shorter path match a longer pattern', () => {
    expect(matchPath('/bag/items/:id/quantity', '/bag/items/abc')).toBeNull();
  });

  it('refuses a different literal segment', () => {
    expect(matchPath('/bag/items/:id', '/bag/categories/abc')).toBeNull();
  });

  it('treats a trailing slash as the same path', () => {
    expect(matchPath('/bag/items', '/bag/items/')).toEqual({});
  });

  it('decodes an encoded parameter', () => {
    expect(matchPath('/bag/items/:id', '/bag/items/a%20b')).toEqual({ id: 'a b' });
  });

  it('will not match an empty segment to a parameter', () => {
    // '/bag/items//' collapses to two segments, so there is no id to capture.
    expect(matchPath('/bag/items/:id', '/bag/items//')).toBeNull();
  });

  it('keeps the auth and bag prefixes apart', () => {
    expect(matchPath('/auth/users/me', '/bag/users/me')).toBeNull();
    expect(matchPath('/auth/sessions', '/auth/sessions')).toEqual({});
  });
});
