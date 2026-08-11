import { createHash } from 'node:crypto';
import { toISODate } from '../lib/dates';
import { send, isConfigured } from '../lib/email';
import { signUnsubscribeToken } from '../lib/token';
import * as digests from '../repositories/digestRepository';
import type { DigestRow } from '../repositories/digestRepository';

/**
 * The daily expiry reminder.
 *
 * Ten days is the same threshold the app itself calls "expiring", so what
 * lands in the inbox matches what the badge says on screen.
 */
export const WITHIN_DAYS = 10;

export interface DigestLine {
  itemId: string;
  name: string;
  categoryName: string;
  quantity: number;
  expiresOn: string;
  /** Negative once it's in the past. */
  daysLeft: number;
}

export interface UserDigest {
  userId: string;
  email: string;
  lastSignature: string | null;
  expiring: DigestLine[];
  expired: DigestLine[];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/** Rows arrive ordered by user, so a single pass groups them. */
export function groupByUser(rows: DigestRow[], today: string): UserDigest[] {
  const byUser = new Map<string, UserDigest>();

  for (const row of rows) {
    let digest = byUser.get(row.user_id);
    if (!digest) {
      digest = {
        userId: row.user_id,
        email: row.email,
        lastSignature: row.last_digest_signature,
        expiring: [],
        expired: [],
      };
      byUser.set(row.user_id, digest);
    }

    const line: DigestLine = {
      itemId: row.item_id,
      name: row.item_name,
      categoryName: row.category_name,
      quantity: row.quantity,
      expiresOn: row.expires_on,
      daysLeft: daysBetween(today, row.expires_on),
    };

    (line.daysLeft < 0 ? digest.expired : digest.expiring).push(line);
  }

  return [...byUser.values()];
}

/**
 * A fingerprint of what this reminder would say.
 *
 * Item ids and which bucket each fell into — not the day count, deliberately.
 * Counting down would change the fingerprint every morning and mail someone
 * daily about a tin they already know about. Something has to actually move
 * between buckets, or appear, or disappear, before it's worth another email.
 */
export function signatureFor(digest: UserDigest): string {
  const parts = [
    ...digest.expiring.map((line) => `e:${line.itemId}`),
    ...digest.expired.map((line) => `x:${line.itemId}`),
  ].sort();

  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function describeDays(daysLeft: number): string {
  if (daysLeft < 0) {
    const ago = Math.abs(daysLeft);
    return ago === 1 ? 'yesterday' : `${ago} days ago`;
  }
  if (daysLeft === 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  return `in ${daysLeft} days`;
}

function subjectFor(digest: UserDigest): string {
  const total = digest.expiring.length + digest.expired.length;
  const thing = total === 1 ? 'thing' : 'things';
  return `${total} ${thing} in your bag need attention`;
}

export function renderText(digest: UserDigest, appUrl: string, unsubscribeUrl: string): string {
  const lines: string[] = [];

  if (digest.expiring.length > 0) {
    lines.push('EXPIRING SOON');
    for (const line of digest.expiring) {
      lines.push(`  ${line.name} (${line.categoryName}) — ${describeDays(line.daysLeft)}`);
    }
    lines.push('');
  }

  if (digest.expired.length > 0) {
    lines.push('ALREADY EXPIRED');
    for (const line of digest.expired) {
      lines.push(`  ${line.name} (${line.categoryName}) — ${describeDays(line.daysLeft)}`);
    }
    lines.push('');
  }

  lines.push(`Open your bag: ${appUrl}`);
  lines.push('');
  lines.push(`Stop these reminders: ${unsubscribeUrl}`);

  return lines.join('\n');
}

/** Mail clients strip most CSS, so this stays tables and inline styles. */
export function renderHtml(
  digest: UserDigest,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const section = (title: string, lines: DigestLine[], accent: string) => {
    if (lines.length === 0) return '';

    const rows = lines
      .map(
        (line) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e3dbda;">
              <div style="font-weight:600;color:#17110f;">${escape(line.name)}</div>
              <div style="font-size:13px;color:#6f625f;">${escape(line.categoryName)} · qty ${line.quantity}</div>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #e3dbda;text-align:right;white-space:nowrap;color:${accent};font-weight:600;font-size:14px;">
              ${escape(describeDays(line.daysLeft))}
            </td>
          </tr>`,
      )
      .join('');

    return `
      <p style="margin:24px 0 4px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#6f625f;">${title}</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>`;
  };

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f7f4f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#17110f;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e3dbda;border-radius:6px;padding:28px;" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td>
                <h1 style="margin:0 0 6px;font-size:20px;">${escape(subjectFor(digest))}</h1>
                <p style="margin:0;font-size:14px;color:#6f625f;">Here's what to check in your grab-n-go bag.</p>

                ${section('Expiring soon', digest.expiring, '#8a5300')}
                ${section('Already expired', digest.expired, '#be1622')}

                <p style="margin:28px 0 0;">
                  <a href="${appUrl}" style="display:inline-block;background:#be1622;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:6px;">Open your bag</a>
                </p>

                <p style="margin:24px 0 0;font-size:12px;color:#6f625f;border-top:1px solid #e3dbda;padding-top:16px;">
                  You're getting this because you have an account on GrabnGo bag.
                  <a href="${unsubscribeUrl}" style="color:#6f625f;">Stop these reminders</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface RunSummary {
  usersWithItems: number;
  skippedUnchanged: number;
  sent: number;
  failed: number;
}

/**
 * One run of the job. Failures are per-user: a bounce or a provider hiccup for
 * one address must not stop everyone behind them in the list.
 */
export async function sendDailyDigests(today = new Date()): Promise<RunSummary> {
  const day = toISODate(today);
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  const rows = await digests.findExpiringItems(WITHIN_DAYS, day);
  const grouped = groupByUser(rows, day);

  const summary: RunSummary = {
    usersWithItems: grouped.length,
    skippedUnchanged: 0,
    sent: 0,
    failed: 0,
  };

  if (!isConfigured()) {
    console.warn(
      `email not configured — ${grouped.length} user(s) would have been mailed`,
    );
    return summary;
  }

  for (const digest of grouped) {
    const signature = signatureFor(digest);
    if (signature === digest.lastSignature) {
      summary.skippedUnchanged += 1;
      continue;
    }

    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${signUnsubscribeToken(digest.userId)}`;

    const result = await send({
      to: digest.email,
      subject: subjectFor(digest),
      html: renderHtml(digest, appUrl, unsubscribeUrl),
      text: renderText(digest, appUrl, unsubscribeUrl),
      unsubscribeUrl,
    });

    if (result.sent) {
      // Only after a confirmed send — otherwise a failure would be recorded as
      // delivered and the user would hear nothing until their bag changed.
      await digests.markDigestSent(digest.userId, signature);
      summary.sent += 1;
    } else {
      console.error(`digest to ${digest.email} failed: ${result.reason}`);
      summary.failed += 1;
    }
  }

  return summary;
}

export async function unsubscribe(userId: string): Promise<boolean> {
  return digests.setNotifyEmail(userId, false);
}
