/**
 * Tests for components/organisms/PipelineMaintenancePanel.tsx
 *
 * The panel has three purge buttons. Clicking a button runs the dry-run
 * first, pops a confirmation modal with the count + sample IDs, then
 * sends a real run only after the operator confirms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-pipeline-maintenance', () => ({
  usePipelineMaintenance: vi.fn(),
}))

import { usePipelineMaintenance } from '@/lib/hooks/use-pipeline-maintenance'
import { PipelineMaintenancePanel } from '@/components/organisms/PipelineMaintenancePanel'

const mockHook = vi.mocked(usePipelineMaintenance)

describe('PipelineMaintenancePanel', () => {
  let runMaintenance: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    runMaintenance = vi.fn()
    mockHook.mockReturnValue({
      runMaintenance,
      isRunning: false,
      error: null,
    })
  })

  it('renders the three purge buttons and a heading', () => {
    render(<PipelineMaintenancePanel />)
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /purge unembedded articles/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /purge orphan stories/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /purge expired articles/i })
    ).toBeInTheDocument()
  })

  it('runs a dry-run first on button click and opens the confirmation modal', async () => {
    runMaintenance.mockResolvedValueOnce({
      action: 'purge_unembedded_articles',
      dryRun: true,
      deletedCount: 7,
      sampleIds: ['a1', 'a2', 'a3'],
      auditId: 'audit-1',
    })

    render(<PipelineMaintenancePanel />)
    fireEvent.click(
      screen.getByRole('button', { name: /purge unembedded articles/i })
    )

    await waitFor(() => {
      expect(runMaintenance).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'purge_unembedded_articles',
          dryRun: true,
        })
      )
    })

    // Confirmation button exists — when it is mounted the modal is open.
    expect(
      await screen.findByRole('button', { name: /confirm/i })
    ).toBeInTheDocument()
    // Deleted count is rendered inside the modal
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('sends the real run only after confirm is clicked', async () => {
    runMaintenance.mockResolvedValueOnce({
      action: 'purge_orphan_stories',
      dryRun: true,
      deletedCount: 2,
      sampleIds: ['s1', 's2'],
      auditId: 'audit-2',
    })
    runMaintenance.mockResolvedValueOnce({
      action: 'purge_orphan_stories',
      dryRun: false,
      deletedCount: 2,
      sampleIds: ['s1', 's2'],
      auditId: 'audit-3',
    })

    render(<PipelineMaintenancePanel />)
    fireEvent.click(
      screen.getByRole('button', { name: /purge orphan stories/i })
    )

    const confirm = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(runMaintenance).toHaveBeenCalledTimes(2)
    })

    expect(runMaintenance).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'purge_orphan_stories',
        dryRun: false,
      })
    )
  })

  it('closes the modal on Cancel without sending a real run', async () => {
    runMaintenance.mockResolvedValueOnce({
      action: 'purge_expired_articles',
      dryRun: true,
      deletedCount: 0,
      sampleIds: [],
      auditId: 'audit-4',
    })

    render(<PipelineMaintenancePanel />)
    fireEvent.click(
      screen.getByRole('button', { name: /purge expired articles/i })
    )

    const cancel = await screen.findByRole('button', { name: /cancel/i })
    fireEvent.click(cancel)

    // Only the dry-run went through
    expect(runMaintenance).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('clears pending state synchronously so double-confirm cannot double-fire', async () => {
    runMaintenance.mockResolvedValueOnce({
      action: 'purge_unembedded_articles',
      dryRun: true,
      deletedCount: 2,
      sampleIds: ['a1', 'a2'],
      auditId: 'audit-1',
    })
    // Second real-run call must never happen. Stub it to throw so if it
    // does happen, the test blows up loudly.
    let realRunInProgress: (value: unknown) => void = () => undefined
    runMaintenance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          realRunInProgress = resolve
        })
    )

    render(<PipelineMaintenancePanel />)
    fireEvent.click(
      screen.getByRole('button', { name: /purge unembedded articles/i })
    )

    const confirm = await screen.findByRole('button', { name: /confirm/i })
    // Rapid double click BEFORE the pending real-run settles
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    // Give React a microtask to react — pending should be cleared after
    // the first click, so the second click's handler is a no-op.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    })

    // Unblock the in-flight call
    realRunInProgress({
      action: 'purge_unembedded_articles',
      dryRun: false,
      deletedCount: 2,
      sampleIds: ['a1', 'a2'],
      auditId: 'audit-2',
    })

    // Exactly one dry-run + one real run = 2 calls total
    await waitFor(() => {
      expect(runMaintenance).toHaveBeenCalledTimes(2)
    })
  })

  it('shows an error banner when dry-run fails', async () => {
    runMaintenance.mockRejectedValueOnce(new Error('boom'))

    render(<PipelineMaintenancePanel />)
    fireEvent.click(
      screen.getByRole('button', { name: /purge unembedded articles/i })
    )

    expect(await screen.findByText(/boom/)).toBeInTheDocument()
  })
})
