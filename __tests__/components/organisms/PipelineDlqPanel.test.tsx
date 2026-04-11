/**
 * Tests for components/organisms/PipelineDlqPanel.tsx
 *
 * Panel tile for the dead-letter queue. Renders a list of unreplayed
 * entries, each with Replay / Dismiss buttons. Success path mutates
 * via the hook; 409-conflict surfaces an error banner.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('@/lib/hooks/use-dlq', () => ({
  useDlq: vi.fn(),
}))

import { useDlq } from '@/lib/hooks/use-dlq'
import { PipelineDlqPanel } from '@/components/organisms/PipelineDlqPanel'
import type { DlqEntry } from '@/lib/pipeline/dead-letter'

const mockHook = vi.mocked(useDlq)

const makeEntry = (overrides: Partial<DlqEntry> = {}): DlqEntry => ({
  id: '11111111-1111-1111-1111-111111111111',
  itemKind: 'article_embed',
  itemId: 'article-abcdef1234',
  retryCount: 5,
  lastError: 'gemini 429 rate limited',
  failedAt: new Date(Date.now() - 60_000).toISOString(),
  replayedAt: null,
  ...overrides,
})

describe('PipelineDlqPanel', () => {
  let replay: ReturnType<typeof vi.fn>
  let dismiss: ReturnType<typeof vi.fn>
  let refresh: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    replay = vi.fn().mockResolvedValue(undefined)
    dismiss = vi.fn().mockResolvedValue(undefined)
    refresh = vi.fn().mockResolvedValue(undefined)
  })

  it('renders the heading', () => {
    mockHook.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    expect(screen.getByText(/Dead Letter Queue/i)).toBeInTheDocument()
  })

  it('renders an empty state when there are no entries', () => {
    mockHook.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    expect(screen.getByText(/nothing to replay/i)).toBeInTheDocument()
  })

  it('renders a loading state while the hook is fetching', () => {
    mockHook.mockReturnValue({
      entries: [],
      isLoading: true,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    const { container } = render(<PipelineDlqPanel />)
    // The shimmer skeletons use animate-shimmer — present while isLoading.
    expect(container.querySelector('.animate-shimmer')).not.toBeNull()
  })

  it('renders rows for each DLQ entry and truncates the item ID', () => {
    const entry = makeEntry()
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    // First 8 chars of item_id with trailing ellipsis
    expect(screen.getByText(/^article-…$/)).toBeInTheDocument()
    // Item kind
    expect(screen.getByText(/article_embed/i)).toBeInTheDocument()
    // Retry count
    expect(screen.getByText('5')).toBeInTheDocument()
    // Both action buttons
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('calls replay on the hook when Replay is clicked', async () => {
    const entry = makeEntry()
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    fireEvent.click(screen.getByRole('button', { name: /replay/i }))

    await waitFor(() => {
      expect(replay).toHaveBeenCalledWith(entry.id)
    })
  })

  it('calls dismiss on the hook when Dismiss is clicked', async () => {
    const entry = makeEntry()
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => {
      expect(dismiss).toHaveBeenCalledWith(entry.id)
    })
  })

  it('surfaces a conflict error banner when replay throws a 409 message', async () => {
    const entry = makeEntry()
    replay.mockRejectedValueOnce(
      new Error(
        'Cannot replay DLQ entry: story is currently being assembled or its assembly_version moved'
      )
    )
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    fireEvent.click(screen.getByRole('button', { name: /replay/i }))

    expect(await screen.findByText(/assembly_version moved/i)).toBeInTheDocument()
  })

  it('renders the last error as plain text (no HTML injection)', () => {
    const entry = makeEntry({
      lastError: '<script>alert(1)</script>',
    })
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    const { container } = render(<PipelineDlqPanel />)
    // The raw HTML must never end up as a real script element.
    expect(container.querySelector('script')).toBeNull()
    // The textContent should include the escaped string verbatim.
    expect(container.textContent).toMatch(/<script>alert\(1\)<\/script>/)
  })

  it('disables action buttons while an action is in-flight', async () => {
    const entry = makeEntry()
    let resolveReplay: (() => void) | null = null
    replay.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveReplay = resolve
        })
    )
    mockHook.mockReturnValue({
      entries: [entry],
      isLoading: false,
      error: null,
      refresh,
      replay,
      dismiss,
    })

    render(<PipelineDlqPanel />)
    const replayBtn = screen.getByRole('button', { name: /replay/i })
    fireEvent.click(replayBtn)

    // While the promise is pending the button should be disabled to
    // prevent double-submit.
    await waitFor(() => {
      expect((replayBtn as HTMLButtonElement).disabled).toBe(true)
    })

    // Clean up inside act() so the post-resolve state update is
    // captured by React's test scheduler.
    await act(async () => {
      resolveReplay?.()
    })
  })
})
