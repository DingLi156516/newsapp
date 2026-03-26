/**
 * lib/email/resend-client.ts — Resend email client initialization.
 *
 * Creates a configured Resend instance from the RESEND_API_KEY env var.
 */

import { Resend } from 'resend'

let resendInstance: Resend | null = null

export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'digest@axiom.news'
}
