/**
 * Sending mail, via Resend's REST API.
 *
 * No SDK: it is one POST, and a dependency that wraps one POST is a dependency
 * that has to be kept current for no reason.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * The URL that turns these off. It becomes both a link in the body and a
   * `List-Unsubscribe` header — Gmail surfaces the header as a one-click
   * control next to the sender, and treats its absence on bulk mail as a
   * negative signal.
   */
  unsubscribeUrl: string;
}

export type SendResult =
  | { sent: true; id: string }
  | { sent: false; reason: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Unconfigured is a normal state, not an error: the API runs perfectly well
 * before a sending domain exists, it just doesn't send. Saying so once per
 * attempt beats crashing a scheduled job that has other users to get through.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function send(email: Email): Promise<SendResult> {
  if (!isConfigured()) {
    return { sent: false, reason: 'email not configured (RESEND_API_KEY / EMAIL_FROM)' };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          'List-Unsubscribe': `<${email.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, reason: `${response.status} ${body.slice(0, 200)}` };
    }

    const { id } = (await response.json()) as { id?: string };
    return { sent: true, id: id ?? 'unknown' };
  } catch (error) {
    // A provider outage must not take the whole run down.
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
