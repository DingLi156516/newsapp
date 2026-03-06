/**
 * Tests for components/organisms/SettingsForm.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsForm } from '@/components/organisms/SettingsForm'
import { TOPIC_LABELS } from '@/lib/types'

const mockUpdatePreferences = vi.fn()

vi.mock('framer-motion')
vi.mock('@/lib/hooks/use-preferences', () => ({
  usePreferences: vi.fn(),
}))

import { usePreferences } from '@/lib/hooks/use-preferences'
const mockUsePreferences = vi.mocked(usePreferences)

const DEFAULT_PREFS = {
  followed_topics: [] as string[],
  default_perspective: 'all' as const,
  factuality_minimum: 'mixed' as const,
}

function mockPreferences(overrides: Record<string, unknown> = {}) {
  mockUsePreferences.mockReturnValue({
    preferences: { ...DEFAULT_PREFS, ...overrides },
    updatePreferences: mockUpdatePreferences,
    isLoading: false,
  } as never)
}

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdatePreferences.mockResolvedValue(undefined)
  })

  it('renders loading skeleton when preferences loading', () => {
    mockUsePreferences.mockReturnValue({
      preferences: DEFAULT_PREFS,
      updatePreferences: mockUpdatePreferences,
      isLoading: true,
    } as never)

    const { container } = render(<SettingsForm />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders topic pills for all 9 topics', () => {
    mockPreferences()
    render(<SettingsForm />)

    const topicLabels = Object.values(TOPIC_LABELS)
    for (const label of topicLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows followed topic with selected styling', () => {
    mockPreferences({ followed_topics: ['politics'] })
    render(<SettingsForm />)

    const politicsBtn = screen.getByText('Politics')
    expect(politicsBtn.className).toContain('bg-white/20')
  })

  it('renders perspective selector with 4 options', () => {
    mockPreferences()
    render(<SettingsForm />)

    expect(screen.getByText('All Perspectives')).toBeInTheDocument()
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('Center')).toBeInTheDocument()
    expect(screen.getByText('Right')).toBeInTheDocument()
  })

  it('renders factuality selector with 5 options', () => {
    mockPreferences()
    render(<SettingsForm />)

    expect(screen.getByText('Very High Factuality')).toBeInTheDocument()
    expect(screen.getByText('High Factuality')).toBeInTheDocument()
    expect(screen.getByText('Mixed Factuality')).toBeInTheDocument()
    expect(screen.getByText('Low Factuality')).toBeInTheDocument()
    expect(screen.getByText('Very Low Factuality')).toBeInTheDocument()
  })

  it('calls updatePreferences when topic toggled', async () => {
    mockPreferences()
    const user = userEvent.setup()
    render(<SettingsForm />)

    await user.click(screen.getByText('Politics'))
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      followed_topics: ['politics'],
    })
  })

})
