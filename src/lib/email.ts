/**
 * Sending mail, through Gmail's SMTP server.
 *
 * Gmail rather than a sending service because it needs no domain: mail leaves
 * from a real Gmail address, so SPF and DKIM pass on their own and it reaches
 * other Gmail inboxes rather than their spam folders. The cap is ~500 messages
 * a day, far beyond what this sends.
 *
 * Everything provider-specific is in this file. Moving to a sending service on
 * a custom domain later means rewriting `send` and nothing else.
 */

import nodemailer, { type Transporter } from 'nodemailer';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * The URL that turns these off. It becomes both a link in the body and a
   * `List-Unsubscribe` header — Gmail surfaces the header as a one-click
   * control beside the sender, and counts its absence against bulk mail.
   */
  unsubscribeUrl: string;
}

export type SendResult =
  | { sent: true; id: string }
  | { sent: false; reason: string };

const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'GrabnGo bag';

/**
 * Unconfigured is a normal state, not an error: the API runs perfectly well
 * before mail is set up, it just doesn't send. Reporting that beats crashing a
 * scheduled job that has other users to get through.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/**
 * Built once per container and reused. Handshaking TLS and authenticating on
 * every message would dominate the cost of sending one.
 */
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        // An app password, not the account password — see the README.
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

/**
 * Gmail only lets you send as the account you authenticated with, so the
 * address is fixed and only the display name is ours to choose. Setting it
 * from `GMAIL_USER` removes a way to get this wrong.
 */
export function fromAddress(): string {
  return `${FROM_NAME} <${process.env.GMAIL_USER}>`;
}

export async function send(email: Email): Promise<SendResult> {
  if (!isConfigured()) {
    return {
      sent: false,
      reason: 'email not configured (GMAIL_USER / GMAIL_APP_PASSWORD)',
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from: fromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: {
        'List-Unsubscribe': `<${email.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    return { sent: true, id: info.messageId };
  } catch (error) {
    // A refused recipient or a Gmail hiccup must not take the whole run down.
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

/** Proves the credentials work without sending anything. */
export async function verifyConnection(): Promise<void> {
  await getTransporter().verify();
}
