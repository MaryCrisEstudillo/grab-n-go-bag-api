/**
 * Sends one real reminder to an address you name, using made-up items.
 *
 *   npm run email:test -- someone@gmail.com
 *
 * Run it the moment the app password is in place: it separates "the
 * credentials work" from "the digest logic works", so a failure points
 * somewhere specific.
 */

import { fromAddress, isConfigured, send, verifyConnection } from '../src/lib/email';
import type { UserDigest } from '../src/services/digestService';

const to = process.argv[2];

if (!to) {
  console.error('Usage: npm run email:test -- someone@gmail.com');
  process.exit(1);
}

if (!isConfigured()) {
  console.error('GMAIL_USER and GMAIL_APP_PASSWORD are not set in .env.');
  console.error('See the "Email reminders" section of the README.');
  process.exit(1);
}

const sample: UserDigest = {
  userId: 'test',
  email: to,
  lastSignature: null,
  expiring: [
    { itemId: '1', name: 'Corned beef', categoryName: 'Canned goods', quantity: 4, expiresOn: '', daysLeft: 3 },
    { itemId: '2', name: 'Antihistamine', categoryName: 'Medicines', quantity: 1, expiresOn: '', daysLeft: 6 },
    { itemId: '3', name: 'Alcohol 70%', categoryName: 'Hygiene kit', quantity: 1, expiresOn: '', daysLeft: 9 },
  ],
  expired: [
    { itemId: '4', name: 'Instant noodles', categoryName: 'Canned goods', quantity: 5, expiresOn: '', daysLeft: -3 },
    { itemId: '5', name: 'Paracetamol 500mg', categoryName: 'Medicines', quantity: 2, expiresOn: '', daysLeft: -14 },
  ],
};

async function main() {
  /**
   * Imported here rather than at the top because the digest module reaches
   * `lib/env.ts`, which throws on a missing DATABASE_URL. Sending a test email
   * has nothing to do with the database, and shouldn't demand one.
   */
  const { renderHtml, renderText } = await import('../src/services/digestService');

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=sample-token`;

  console.log(`from  ${fromAddress()}`);
  console.log(`to    ${to}`);

  process.stdout.write('auth  ');
  await verifyConnection();
  console.log('credentials accepted');

  process.stdout.write('send  ');
  const result = await send({
    to,
    subject: '5 things in your bag need attention',
    html: renderHtml(sample, appUrl, unsubscribeUrl),
    text: renderText(sample, appUrl, unsubscribeUrl),
    unsubscribeUrl,
  });

  if (!result.sent) {
    console.log('FAILED');
    console.error(`\n${result.reason}`);
    if (result.reason.includes('Username and Password not accepted')) {
      console.error(
        '\nThat is the app password being wrong. It is 16 characters from\n' +
          'myaccount.google.com/apppasswords — not your Google password.',
      );
    }
    process.exit(1);
  }

  console.log(`sent (${result.id})`);
  console.log('\nCheck the inbox. If it landed in spam, tell me — that is fixable.');
}

main().catch((error: unknown) => {
  console.error('FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
