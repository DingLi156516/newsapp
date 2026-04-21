/**
 * Tests for components/molecules/RoutingPreviewPanel.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoutingPreviewPanel } from '@/components/molecules/RoutingPreviewPanel'
import type { RoutingPreview } from '@/lib/hooks/use-routing-preview'

function makePreview(overrides: Partial<RoutingPreview> = {}): RoutingPreview {
  return {
    storyId: 'story-1',
    sourceCount: 3,
    biases: ['left', 'center', 'right'],
    distinctBiasBuckets: 3,
    assemblyPath: 'rich',
    appliedThresholds: {
      minSources: 3,
      minBuckets: 2,
      modeOverride: null,
    },
    ...overrides,
  }
}

describe('RoutingPreviewPanel', () => {
  it('renders loading state', () => {
    render(<RoutingPreviewPanel preview={null} isLoading={true} />)
    expect(screen.getByTestId('routing-preview-panel')).toHaveTextContent(
      /loading/i
    )
  })

  it('renders error state', () => {
    render(
      <RoutingPreviewPanel
        preview={null}
        isLoading={false}
        error={new Error('boom')}
      />
    )
    expect(screen.getByTestId('routing-preview-panel')).toHaveTextContent(
      /failed/i
    )
  })

  it('renders nothing when preview is null and not loading/error', () => {
    const { container } = render(
      <RoutingPreviewPanel preview={null} isLoading={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders rich-path preview with L/C/R buckets', () => {
    render(
      <RoutingPreviewPanel
        preview={makePreview({ assemblyPath: 'rich', distinctBiasBuckets: 3 })}
        isLoading={false}
      />
    )
    expect(screen.getByText(/Rich \(Gemini\)/i)).toBeInTheDocument()
    expect(screen.getByText(/3\/3/)).toBeInTheDocument()
  })

  it('renders single-source path with 1 source', () => {
    render(
      <RoutingPreviewPanel
        preview={makePreview({
          assemblyPath: 'single',
          sourceCount: 1,
          biases: ['left'],
          distinctBiasBuckets: 1,
        })}
        isLoading={false}
      />
    )
    expect(screen.getByText(/Single-source/i)).toBeInTheDocument()
  })

  it('derives bucket labels from actual biases (L + R, no C)', () => {
    // L+R cluster. Should render "L · R" not "L · C".
    render(
      <RoutingPreviewPanel
        preview={makePreview({
          assemblyPath: 'thin',
          sourceCount: 2,
          biases: ['left', 'right'],
          distinctBiasBuckets: 2,
        })}
        isLoading={false}
      />
    )
    expect(screen.getByText(/2\/3.*L · R/)).toBeInTheDocument()
  })

  it('derives bucket labels for right-only cluster', () => {
    render(
      <RoutingPreviewPanel
        preview={makePreview({
          assemblyPath: 'thin',
          sourceCount: 1,
          biases: ['right'],
          distinctBiasBuckets: 1,
        })}
        isLoading={false}
      />
    )
    expect(screen.getByText(/1\/3 \(R\)/)).toBeInTheDocument()
  })

  it('renders thin path', () => {
    render(
      <RoutingPreviewPanel
        preview={makePreview({
          assemblyPath: 'thin',
          sourceCount: 2,
          biases: ['left', 'right'],
          distinctBiasBuckets: 2,
        })}
        isLoading={false}
      />
    )
    expect(screen.getByText(/Thin \(deterministic\)/i)).toBeInTheDocument()
  })

  it('renders deterministic mode override', () => {
    render(
      <RoutingPreviewPanel
        preview={makePreview({
          assemblyPath: 'rich',
          appliedThresholds: {
            minSources: 3,
            minBuckets: 2,
            modeOverride: 'deterministic',
          },
        })}
        isLoading={false}
      />
    )
    // Specific to the override dd (avoids the "Thin (deterministic)"
    // path label in the other branch).
    expect(screen.getByText('deterministic')).toBeInTheDocument()
  })

  it('renders "none" when no mode override is set', () => {
    render(
      <RoutingPreviewPanel preview={makePreview()} isLoading={false} />
    )
    expect(screen.getByText(/none/)).toBeInTheDocument()
  })

  it('reflects custom thresholds', () => {
    const { container } = render(
      <RoutingPreviewPanel
        preview={makePreview({
          appliedThresholds: { minSources: 4, minBuckets: 3, modeOverride: null },
        })}
        isLoading={false}
      />
    )
    expect(container.textContent).toContain('≥4 sources')
    expect(container.textContent).toContain('≥3 buckets')
  })
})
