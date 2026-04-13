import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/organisms/AdminSourceList', () => ({
  AdminSourceList: (props: Record<string, unknown>) => (
    <div data-testid="admin-source-list">
      <button onClick={() => (props.onCreateNew as () => void)()}>Create</button>
      <button onClick={() => (props.onImport as () => void)()}>Import</button>
    </div>
  ),
}))

vi.mock('@/components/organisms/AdminSourceDetail', () => ({
  AdminSourceDetail: (props: Record<string, unknown>) => (
    <div data-testid="admin-source-detail">
      Detail: {props.source ? (props.source as { name: string }).name : 'none'}
    </div>
  ),
}))

vi.mock('@/components/organisms/AdminSourceCreate', () => ({
  AdminSourceCreate: (props: Record<string, unknown>) => (
    <div data-testid="admin-source-create">
      <button onClick={() => (props.onCancel as () => void)()}>CancelCreate</button>
    </div>
  ),
}))

vi.mock('@/components/organisms/AdminSourceImport', () => ({
  AdminSourceImport: (props: Record<string, unknown>) => (
    <div data-testid="admin-source-import">
      <button onClick={() => (props.onCancel as () => void)()}>CancelImport</button>
    </div>
  ),
}))

vi.mock('@/lib/hooks/use-admin-sources', () => ({
  useSyncRatings: vi.fn(),
}))

vi.mock('@/lib/hooks/use-owners', () => ({
  useOwners: vi.fn(),
}))

vi.mock('swr', () => ({
  default: vi.fn(),
  useSWRConfig: vi.fn(() => ({ mutate: vi.fn() })),
}))

import { useSyncRatings } from '@/lib/hooks/use-admin-sources'
import { useOwners } from '@/lib/hooks/use-owners'
import { SourceAdminManager } from '@/components/organisms/SourceAdminManager'

const mockSyncRatings = vi.fn()
const mockUseSyncRatings = vi.mocked(useSyncRatings)
const mockUseOwners = vi.mocked(useOwners)

describe('SourceAdminManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSyncRatings.mockResolvedValue({
      success: true,
      data: { synced: 5, skipped: 0, overridden: 1, unmatched: 2, errors: [] },
    })
    mockUseSyncRatings.mockReturnValue({
      syncRatings: mockSyncRatings,
      isSyncing: false,
      error: null,
    })
    mockUseOwners.mockReturnValue({
      owners: [],
      error: undefined,
      isLoading: false,
    })
  })

  function renderComponent() {
    return render(<SourceAdminManager />)
  }

  it('renders AdminSourceList and AdminSourceDetail by default', () => {
    renderComponent()

    expect(screen.getByTestId('admin-source-list')).toBeInTheDocument()
    expect(screen.getByTestId('admin-source-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-create')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-import')).not.toBeInTheDocument()
  })

  it('shows Sync Ratings button', () => {
    renderComponent()

    expect(screen.getByText('Sync Ratings')).toBeInTheDocument()
  })

  it('shows sync result message after successful sync', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Sync Ratings'))

    await waitFor(() => {
      expect(screen.getByText('Synced 5 sources, 1 overridden, 2 unmatched')).toBeInTheDocument()
    })

    expect(mockSyncRatings).toHaveBeenCalledOnce()
  })

  it('shows error message on sync failure', async () => {
    mockSyncRatings.mockRejectedValue(new Error('Sync service unavailable'))

    renderComponent()

    fireEvent.click(screen.getByText('Sync Ratings'))

    await waitFor(() => {
      expect(screen.getByText('Sync service unavailable')).toBeInTheDocument()
    })
  })

  it('switches to create panel when Create button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Create'))

    expect(screen.getByTestId('admin-source-create')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-detail')).not.toBeInTheDocument()
  })

  it('switches to import panel when Import button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Import'))

    expect(screen.getByTestId('admin-source-import')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-detail')).not.toBeInTheDocument()
  })

  it('returns to detail panel when create is cancelled', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Create'))
    expect(screen.getByTestId('admin-source-create')).toBeInTheDocument()

    fireEvent.click(screen.getByText('CancelCreate'))
    expect(screen.getByTestId('admin-source-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-create')).not.toBeInTheDocument()
  })

  it('returns to detail panel when import is cancelled', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Import'))
    expect(screen.getByTestId('admin-source-import')).toBeInTheDocument()

    fireEvent.click(screen.getByText('CancelImport'))
    expect(screen.getByTestId('admin-source-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-source-import')).not.toBeInTheDocument()
  })
})
