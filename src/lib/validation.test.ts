import { describe, expect, it } from 'vitest';
import {
  checkDatePacked,
  checkEmail,
  checkExpiresOn,
  checkISODate,
  checkName,
  checkPassword,
  checkQuantity,
  clampQuantity,
  parseBody,
} from './validation';

const TODAY = new Date('2026-08-11T12:00:00Z');

describe('email', () => {
  it('accepts an ordinary address', () => {
    expect(checkEmail('someone@example.com')).toBeNull();
  });

  it.each([['no-at-sign'], ['no@tld'], ['spaces in@example.com'], ['']])(
    'rejects %j',
    (value) => {
      expect(checkEmail(value)).not.toBeNull();
    },
  );

  it('rejects a non-string, rather than trusting the body', () => {
    expect(checkEmail(42)).not.toBeNull();
    expect(checkEmail(null)).not.toBeNull();
  });
});

describe('password', () => {
  it('takes exactly eight characters', () => {
    expect(checkPassword('12345678')).toBeNull();
  });

  it('rejects seven', () => {
    expect(checkPassword('1234567')).not.toBeNull();
  });
});

describe('name', () => {
  it('rejects whitespace-only', () => {
    expect(checkName('   ', 'item')).not.toBeNull();
  });

  it('takes 80 characters but not 81', () => {
    expect(checkName('x'.repeat(80), 'item')).toBeNull();
    expect(checkName('x'.repeat(81), 'item')).not.toBeNull();
  });
});

describe('quantity', () => {
  it('allows zero — a packed-but-used-up item is a real state', () => {
    expect(checkQuantity(0)).toBeNull();
  });

  it('rejects a fraction rather than truncating it', () => {
    expect(checkQuantity(3.5)).not.toBeNull();
  });

  it.each([[-1], [10_000]])('rejects %d as out of range', (value) => {
    expect(checkQuantity(value)).not.toBeNull();
  });

  it('rejects a numeric string — JSON numbers are numbers', () => {
    expect(checkQuantity('3')).not.toBeNull();
  });

  it('clamps instead of erroring, for the stepper', () => {
    expect(clampQuantity(-5)).toBe(0);
    expect(clampQuantity(99_999)).toBe(9999);
    expect(clampQuantity(Number.NaN)).toBe(0);
  });
});

describe('date shape', () => {
  it('accepts a real calendar day', () => {
    expect(checkISODate('2026-02-28')).toBeNull();
  });

  it('rejects a day that does not exist, which the pattern alone would allow', () => {
    expect(checkISODate('2026-02-31')).not.toBeNull();
    expect(checkISODate('2026-13-01')).not.toBeNull();
  });

  it.each([['11/08/2026'], ['2026-8-1'], ['2026-08-11T00:00:00Z']])(
    'rejects %j as the wrong format',
    (value) => {
      expect(checkISODate(value)).not.toBeNull();
    },
  );
});

describe('date packed', () => {
  it('allows today', () => {
    expect(checkDatePacked('2026-08-11', TODAY)).toBeNull();
  });

  it('allows the past', () => {
    expect(checkDatePacked('2020-01-01', TODAY)).toBeNull();
  });

  it('rejects tomorrow — you cannot pack something in the future', () => {
    expect(checkDatePacked('2026-08-12', TODAY)).not.toBeNull();
  });
});

describe('expiry', () => {
  it('treats a missing expiry as valid — a crowbar does not expire', () => {
    expect(checkExpiresOn(null, '2026-08-11', TODAY)).toBeNull();
    expect(checkExpiresOn(undefined, '2026-08-11', TODAY)).toBeNull();
  });

  it('allows an expiry already in the past — you may be logging something dead', () => {
    expect(checkExpiresOn('2026-08-01', '2026-07-01', TODAY)).toBeNull();
  });

  it('allows expiring on the day it was packed', () => {
    expect(checkExpiresOn('2026-08-11', '2026-08-11', TODAY)).toBeNull();
  });

  it('rejects an expiry before the date packed', () => {
    expect(checkExpiresOn('2026-08-10', '2026-08-11', TODAY)).not.toBeNull();
  });

  it('rejects the mistyped year', () => {
    expect(checkExpiresOn('2206-08-11', '2026-08-11', TODAY)).not.toBeNull();
  });
});

describe('body parsing', () => {
  it('treats an absent body as an empty object', () => {
    expect(parseBody(undefined)).toEqual({});
  });

  it('rejects a JSON array, which is not a body shape any endpoint takes', () => {
    expect(() => parseBody('[1,2,3]')).toThrow();
  });

  it('rejects malformed JSON without crashing', () => {
    expect(() => parseBody('{oops')).toThrow();
  });
});
