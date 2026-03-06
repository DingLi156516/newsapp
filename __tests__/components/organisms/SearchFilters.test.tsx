import { render, screen, fireEvent } from '@testing-library/react'
import { SearchFilters } from '@/components/organisms/SearchFilters'
import type { BiasCategory, FactualityLevel, DatePreset, Topic } from '@/lib/types'
import { ALL_BIASES, TOPIC_LABELS } from '@/lib/types'

function renderFilters(overrides: Partial<{
  topic: Topic | null
  onTopicChange: (v: Topic | null) => void
  biasRange: BiasCategory[]
  onBiasRangeChange: (v: BiasCategory[]) => void
  minFactuality: FactualityLevel | null
  onMinFactualityChange: (v: FactualityLevel | null) => void
  datePreset: DatePreset
  onDatePresetChange: (v: DatePreset) => void
}> = {}) {
  const props = {
    topic: null as Topic | null,
    onTopicChange: vi.fn(),
    biasRange: ALL_BIASES,
    onBiasRangeChange: vi.fn(),
    minFactuality: null,
    onMinFactualityChange: vi.fn(),
    datePreset: 'all' as DatePreset,
    onDatePresetChange: vi.fn(),
    ...overrides,
  }
  return { ...render(<SearchFilters {...props} />), props }
}

describe('SearchFilters', () => {
  it('renders toggle button', () => {
    renderFilters()
    expect(screen.getByTestId('search-filters-toggle')).toBeInTheDocument()
  })

  it('panel is hidden by default', () => {
    renderFilters()
    expect(screen.queryByTestId('search-filters-panel')).not.toBeInTheDocument()
  })

  it('toggles panel on click', () => {
    renderFilters()
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('search-filters-panel')).toBeInTheDocument()
  })

  it('shows active filter count badge when filters are active', () => {
    renderFilters({
      biasRange: ['left', 'center'],
      minFactuality: 'high',
      datePreset: '7d',
    })
    const badge = screen.getByTestId('filter-count-badge')
    expect(badge).toHaveTextContent('3')
  })

  it('does not show badge when no filters active', () => {
    renderFilters()
    expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument()
  })

  it('renders all 7 bias pills when expanded', () => {
    renderFilters()
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    for (const bias of ALL_BIASES) {
      expect(screen.getByTestId(`bias-pill-${bias}`)).toBeInTheDocument()
    }
  })

  it('calls onBiasRangeChange when bias pill clicked', () => {
    const onBiasRangeChange = vi.fn()
    renderFilters({ onBiasRangeChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('bias-pill-left'))
    expect(onBiasRangeChange).toHaveBeenCalled()
  })

  it('calls onMinFactualityChange when factuality pill clicked', () => {
    const onMinFactualityChange = vi.fn()
    renderFilters({ onMinFactualityChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('factuality-pill-high'))
    expect(onMinFactualityChange).toHaveBeenCalledWith('high')
  })

  it('deselects factuality when clicking active pill', () => {
    const onMinFactualityChange = vi.fn()
    renderFilters({ minFactuality: 'high', onMinFactualityChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('factuality-pill-high'))
    expect(onMinFactualityChange).toHaveBeenCalledWith(null)
  })

  it('calls onDatePresetChange when date pill clicked', () => {
    const onDatePresetChange = vi.fn()
    renderFilters({ onDatePresetChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('date-preset-7d'))
    expect(onDatePresetChange).toHaveBeenCalledWith('7d')
  })

  it('marks active date preset as pressed', () => {
    renderFilters({ datePreset: '24h' })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('date-preset-24h')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('date-preset-7d')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clear filters resets all', () => {
    const onTopicChange = vi.fn()
    const onBiasRangeChange = vi.fn()
    const onMinFactualityChange = vi.fn()
    const onDatePresetChange = vi.fn()
    renderFilters({
      topic: 'politics',
      biasRange: ['left'],
      minFactuality: 'high',
      datePreset: '7d',
      onTopicChange,
      onBiasRangeChange,
      onMinFactualityChange,
      onDatePresetChange,
    })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('clear-filters'))
    expect(onTopicChange).toHaveBeenCalledWith(null)
    expect(onBiasRangeChange).toHaveBeenCalledWith(ALL_BIASES)
    expect(onMinFactualityChange).toHaveBeenCalledWith(null)
    expect(onDatePresetChange).toHaveBeenCalledWith('all')
  })

  // Topic filter tests
  it('renders topic pills including All when expanded', () => {
    renderFilters()
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('topic-filter-pill-all')).toBeInTheDocument()
    for (const topic of Object.keys(TOPIC_LABELS)) {
      expect(screen.getByTestId(`topic-filter-pill-${topic}`)).toBeInTheDocument()
    }
  })

  it('calls onTopicChange when topic pill clicked', () => {
    const onTopicChange = vi.fn()
    renderFilters({ onTopicChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('topic-filter-pill-politics'))
    expect(onTopicChange).toHaveBeenCalledWith('politics')
  })

  it('calls onTopicChange with null when All pill clicked', () => {
    const onTopicChange = vi.fn()
    renderFilters({ topic: 'politics', onTopicChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('topic-filter-pill-all'))
    expect(onTopicChange).toHaveBeenCalledWith(null)
  })

  it('includes topic in active filter count', () => {
    renderFilters({ topic: 'politics' })
    const badge = screen.getByTestId('filter-count-badge')
    expect(badge).toHaveTextContent('1')
  })

  it('marks active topic pill as pressed', () => {
    renderFilters({ topic: 'science' })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('topic-filter-pill-science')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('topic-filter-pill-all')).toHaveAttribute('aria-pressed', 'false')
  })

  // Perspective preset tests
  it('renders perspective preset buttons when expanded', () => {
    renderFilters()
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('perspective-preset-all')).toBeInTheDocument()
    expect(screen.getByTestId('perspective-preset-left')).toBeInTheDocument()
    expect(screen.getByTestId('perspective-preset-center')).toBeInTheDocument()
    expect(screen.getByTestId('perspective-preset-right')).toBeInTheDocument()
  })

  it('marks All preset as active when all biases selected', () => {
    renderFilters({ biasRange: ALL_BIASES })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('perspective-preset-left')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks Left preset as active when left biases selected', () => {
    renderFilters({ biasRange: ['far-left', 'left', 'lean-left'] })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('perspective-preset-left')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks no preset as active for custom bias selection', () => {
    renderFilters({ biasRange: ['left', 'center'] })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    expect(screen.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('perspective-preset-left')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('perspective-preset-center')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('perspective-preset-right')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onBiasRangeChange with left biases when Left preset clicked', () => {
    const onBiasRangeChange = vi.fn()
    renderFilters({ onBiasRangeChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('perspective-preset-left'))
    expect(onBiasRangeChange).toHaveBeenCalledWith(['far-left', 'left', 'lean-left'])
  })

  it('calls onBiasRangeChange with all biases when All preset clicked', () => {
    const onBiasRangeChange = vi.fn()
    renderFilters({ biasRange: ['center'], onBiasRangeChange })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('perspective-preset-all'))
    expect(onBiasRangeChange).toHaveBeenCalledWith(ALL_BIASES)
  })

  it('clear filters resets perspective preset to All', () => {
    const onBiasRangeChange = vi.fn()
    renderFilters({
      biasRange: ['left'],
      topic: 'politics',
      onBiasRangeChange,
    })
    fireEvent.click(screen.getByTestId('search-filters-toggle'))
    fireEvent.click(screen.getByTestId('clear-filters'))
    expect(onBiasRangeChange).toHaveBeenCalledWith(ALL_BIASES)
  })
})
