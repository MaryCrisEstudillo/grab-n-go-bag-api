import { describe, expect, it } from 'vitest';
import type { DigestRow } from '../repositories/digestRepository';
import {
  groupByUser,
  renderText,
  signatureFor,
  type UserDigest,
} from './digestService';

const TODAY = '2026-08-11';

const row = (over: Partial<DigestRow> = {}): DigestRow => ({
  user_id: 'u1',
  email: 'someone@example.com',
  last_digest_signature: null,
  item_id: 'i1',
  item_name: 'Corned beef',
  category_name: 'Canned goods',
  quantity: 4,
  expires_on: '2026-08-14',
  ...over,
});

const digest = (over: Partial<UserDigest> = {}): UserDigest => ({
  userId: 'u1',
  email: 'someone@example.com',
  lastSignature: null,
  expiring: [],
  expired: [],
  ...over,
});

describe('grouping', () => {
  it('splits expired from expiring at the boundary', () => {
    const [result] = groupByUser(
      [
        row({ item_id: 'past', expires_on: '2026-08-10' }),
        row({ item_id: 'today', expires_on: '2026-08-11' }),
        row({ item_id: 'soon', expires_on: '2026-08-21' }),
      ],
      TODAY,
    );

    // Expiring today is still usable, and still actionable — not expired.
    expect(result.expiring.map((line) => line.itemId)).toEqual(['today', 'soon']);
    expect(result.expired.map((line) => line.itemId)).toEqual(['past']);
  });

  it('keeps users separate', () => {
    const result = groupByUser(
      [
        row({ user_id: 'u1', item_id: 'a' }),
        row({ user_id: 'u2', email: 'other@example.com', item_id: 'b' }),
        row({ user_id: 'u2', email: 'other@example.com', item_id: 'c' }),
      ],
      TODAY,
    );

    expect(result).toHaveLength(2);
    expect(result[1].email).toBe('other@example.com');
    expect(result[1].expiring).toHaveLength(2);
  });

  it('counts days as calendar days, not elapsed time', () => {
    const [result] = groupByUser([row({ expires_on: '2026-08-14' })], TODAY);
    expect(result.expiring[0].daysLeft).toBe(3);
  });

  it('returns nothing when there is nothing to report', () => {
    expect(groupByUser([], TODAY)).toEqual([]);
  });
});

describe('change detection', () => {
  it('is stable for the same items', () => {
    const a = digest({ expiring: [line('i1'), line('i2')] });
    const b = digest({ expiring: [line('i1'), line('i2')] });

    expect(signatureFor(a)).toBe(signatureFor(b));
  });

  it('ignores the order rows arrive in', () => {
    const a = digest({ expiring: [line('i1'), line('i2')] });
    const b = digest({ expiring: [line('i2'), line('i1')] });

    expect(signatureFor(a)).toBe(signatureFor(b));
  });

  /**
   * The point of the whole mechanism: a bag nobody has touched must not
   * generate a fresh email every morning just because the countdown moved.
   */
  it('does not change as the days tick down', () => {
    const monday = digest({ expiring: [line('i1', 5)] });
    const tuesday = digest({ expiring: [line('i1', 4)] });

    expect(signatureFor(monday)).toBe(signatureFor(tuesday));
  });

  it('changes when an item crosses into expired', () => {
    const before = digest({ expiring: [line('i1', 0)] });
    const after = digest({ expired: [line('i1', -1)] });

    expect(signatureFor(before)).not.toBe(signatureFor(after));
  });

  it('changes when an item is added', () => {
    const before = digest({ expiring: [line('i1')] });
    const after = digest({ expiring: [line('i1'), line('i2')] });

    expect(signatureFor(before)).not.toBe(signatureFor(after));
  });

  it('changes when an item is thrown out', () => {
    const before = digest({ expiring: [line('i1'), line('i2')] });
    const after = digest({ expiring: [line('i1')] });

    expect(signatureFor(before)).not.toBe(signatureFor(after));
  });
});

describe('the text body', () => {
  it('names both sections and the unsubscribe link', () => {
    const body = renderText(
      digest({ expiring: [line('i1', 3)], expired: [line('i2', -2)] }),
      'https://app.example.com',
      'https://api.example.com/unsubscribe?token=abc',
    );

    expect(body).toContain('EXPIRING SOON');
    expect(body).toContain('ALREADY EXPIRED');
    expect(body).toContain('in 3 days');
    expect(body).toContain('2 days ago');
    expect(body).toContain('token=abc');
  });

  it('leaves out a section that has nothing in it', () => {
    const body = renderText(digest({ expiring: [line('i1')] }), 'x', 'y');
    expect(body).not.toContain('ALREADY EXPIRED');
  });

  it('reads naturally at the day boundaries', () => {
    const body = renderText(
      digest({ expiring: [line('i1', 0), line('i2', 1)], expired: [line('i3', -1)] }),
      'x',
      'y',
    );

    expect(body).toContain('today');
    expect(body).toContain('tomorrow');
    expect(body).toContain('yesterday');
  });
});

function line(itemId: string, daysLeft = 3) {
  return {
    itemId,
    name: `Item ${itemId}`,
    categoryName: 'Canned goods',
    quantity: 1,
    expiresOn: '2026-08-14',
    daysLeft,
  };
}
