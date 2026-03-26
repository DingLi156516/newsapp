import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-pipeline', () => ({
  usePipelineTrigger: vi.fn(),
  usePipelineRuns: vi.fn(),
}))

import { usePipelineTrigger, usePipelineRuns } from '@/lib/hooks/use-pipeline'
import { PipelineControls } from '@/components/organisms/PipelineControls'

const mockUsePipelineTrigger = vi.mocked(usePipelineTrigger)
const mockUsePipelineRuns = vi.mocked(usePipelineRuns)

describe('PipelineControls', () => {
  const mockTrigger = vi.fn()
  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePipelineTrigger.mockReturnValue({
      trigger: mockTrigger,
      isTriggering: false,
      error: null,
    })
    mockUsePipelineRuns.mockReturnValue({
      runs: [],
      isLoading: false,
      mutate: mockMutate,
    })
  })

  it('renders three trigger buttons', () => {
    render(<PipelineControls />)

    expect(screen.getByText('Ingest')).toBeInTheDocument()
    expect(screen.getByText('Process')).toBeInTheDocument()
    expect(screen.getByText('Full Pipeline')).toBeInTheDocument()
  })

  it('renders button descriptions', () => {
    render(<PipelineControls />)

    expect(screen.getByText('Fetch RSS feeds')).toBeInTheDocument()
    expect(screen.getByText('Embed → Cluster → Assemble')).toBeInTheDocument()
    expect(screen.getByText('Ingest + Process')).toBeInTheDocument()
  })

  it('clicking a button triggers the pipeline', async () => {
    mockTrigger.mockResolvedValue({ success: true })

    render(<PipelineControls />)

    fireEvent.click(screen.getByText('Ingest'))

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith({ type: 'ingest' })
    })
  })

  it('shows success message after successful trigger', async () => {
    mockTrigger.mockResolvedValue({ success: true })

    render(<PipelineControls />)

    fireEvent.click(screen.getByText('Process'))

    await waitFor(() => {
      expect(screen.getByText('process pipeline completed successfully')).toBeInTheDocument()
    })
  })

  it('shows error message after failed trigger', async () => {
    mockTrigger.mockRejectedValue(new Error('Connection timeout'))

    render(<PipelineControls />)

    fireEvent.click(screen.getByText('Full Pipeline'))

    await waitFor(() => {
      expect(screen.getByText('Connection timeout')).toBeInTheDocument()
    })
  })

  it('shows error message when trigger returns success false', async () => {
    mockTrigger.mockResolvedValue({ success: false })

    render(<PipelineControls />)

    fireEvent.click(screen.getByText('Ingest'))

    await waitFor(() => {
      expect(screen.getByText('Pipeline run failed')).toBeInTheDocument()
    })
  })

  it('buttons are disabled during execution', () => {
    mockUsePipelineTrigger.mockReturnValue({
      trigger: mockTrigger,
      isTriggering: true,
      error: null,
    })

    render(<PipelineControls />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('calls mutate after successful trigger to refresh runs', async () => {
    mockTrigger.mockResolvedValue({ success: true })

    render(<PipelineControls />)

    fireEvent.click(screen.getByText('Ingest'))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })
})
