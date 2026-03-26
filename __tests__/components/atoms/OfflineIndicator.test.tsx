vi.mock('@/lib/hooks/use-online', () => ({
  useOnline: vi.fn(),
}))

import { render, screen } from '@testing-library/react'
import { OfflineIndicator } from '@/components/atoms/OfflineIndicator'
import { useOnline } from '@/lib/hooks/use-online'

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    vi.mocked(useOnline).mockReturnValue({ isOnline: true })
    const { container } = render(<OfflineIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('shows offline banner when offline', () => {
    vi.mocked(useOnline).mockReturnValue({ isOnline: false })
    render(<OfflineIndicator />)
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
    expect(screen.getByText('Viewing cached bookmarks')).toBeInTheDocument()
  })
})
