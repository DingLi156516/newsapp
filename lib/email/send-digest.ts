/**
 * lib/email/send-digest.ts — Send blindspot digest email via Resend.
 *
 * Composes and sends an HTML email containing blindspot stories from the past week.
 */

import { getResendClient, getFromEmail } from '@/lib/email/resend-client'

interface DigestStory {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly sourceCount: number
}

function renderDigestHtml(name: string, stories: readonly DigestStory[]): string {
  const storyRows = stories
    .map(
      (s) =>
        `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #222">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://axiom.news'}/story/${s.id}"
               style="color:#fff;text-decoration:none;font-size:16px;font-weight:600">
              ${s.headline}
            </a>
            <div style="margin-top:4px;font-size:13px;color:#888">
              ${s.topic} &middot; ${s.sourceCount} sources
            </div>
          </td>
        </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif;padding:32px">
  <h1 style="font-size:24px;margin-bottom:8px">Axiom Blindspot Digest</h1>
  <p style="color:#888;margin-bottom:24px">
    Hi ${name}, here are stories with skewed coverage from the past week.
  </p>
  <table style="width:100%;border-collapse:collapse">
    ${storyRows}
  </table>
  <p style="margin-top:32px;font-size:13px;color:#666">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://axiom.news'}/blindspot" style="color:#888">
      View all blindspot stories
    </a>
    &middot;
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://axiom.news'}/settings" style="color:#888">
      Manage preferences
    </a>
  </p>
</body>
</html>`
}

export async function sendBlindspotDigest(
  email: string,
  name: string,
  stories: readonly DigestStory[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient()
    const html = renderDigestHtml(name, stories)

    await resend.emails.send({
      from: `Axiom News <${getFromEmail()}>`,
      to: email,
      subject: `Your Weekly Blindspot Digest — ${stories.length} stories`,
      html,
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send digest email'
    return { success: false, error: message }
  }
}
