vi.mock('@/lib/email/resend-client', () => ({
  getResendClient: vi.fn(),
  getFromEmail: vi.fn().mockReturnValue('digest@axiom.news'),
}))

import { sendBlindspotDigest } from '@/lib/email/send-digest'
import { getResendClient } from '@/lib/email/resend-client'

describe('sendBlindspotDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends email via Resend and returns success', async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: 'msg-1' })
    vi.mocked(getResendClient).mockReturnValue({
      emails: { send: mockSend },
    } as never)

    const result = await sendBlindspotDigest(
      'user@example.com',
      'Alice',
      [
        { id: 's1', headline: 'Story One', topic: 'politics', sourceCount: 5 },
        { id: 's2', headline: 'Story Two', topic: 'world', sourceCount: 3 },
      ]
    )

    expect(result.success).toBe(true)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('2 stories'),
      })
    )
  })

  it('returns error on Resend failure', async () => {
    const mockSend = vi.fn().mockRejectedValue(new Error('API key invalid'))
    vi.mocked(getResendClient).mockReturnValue({
      emails: { send: mockSend },
    } as never)

    const result = await sendBlindspotDigest(
      'user@example.com',
      'Bob',
      [{ id: 's1', headline: 'Story', topic: 'tech', sourceCount: 2 }]
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('API key invalid')
  })

  it('includes story headlines in email HTML', async () => {
    const mockSend = vi.fn().mockResolvedValue({ id: 'msg-2' })
    vi.mocked(getResendClient).mockReturnValue({
      emails: { send: mockSend },
    } as never)

    await sendBlindspotDigest(
      'user@example.com',
      'Carol',
      [{ id: 's1', headline: 'Important Story', topic: 'politics', sourceCount: 4 }]
    )

    const callArgs = mockSend.mock.calls[0][0]
    expect(callArgs.html).toContain('Important Story')
    expect(callArgs.html).toContain('Carol')
  })
})
