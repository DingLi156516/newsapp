import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-admin-sources', () => ({
  useImportSources: vi.fn(),
}))

vi.mock('@/lib/utils/csv-parser', () => ({
  parseCsvString: vi.fn(),
}))

import { useImportSources } from '@/lib/hooks/use-admin-sources'
import { parseCsvString } from '@/lib/utils/csv-parser'
import { AdminSourceImport } from '@/components/organisms/AdminSourceImport'

const mockImportSources = vi.fn()
const mockUseImportSources = vi.mocked(useImportSources)
const mockParseCsvString = vi.mocked(parseCsvString)

describe('AdminSourceImport', () => {
  const onImported = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockImportSources.mockResolvedValue({
      success: true,
      data: { inserted: 3, skipped: 0, errors: [] },
    })
    mockUseImportSources.mockReturnValue({
      importSources: mockImportSources,
      isImporting: false,
      error: null,
    })
  })

  function renderComponent() {
    return render(
      <AdminSourceImport onImported={onImported} onCancel={onCancel} />
    )
  }

  function createCsvFile(name: string, content: string): File {
    return new File([content], name, { type: 'text/csv' })
  }

  it('renders upload area with Choose File button', () => {
    renderComponent()

    expect(screen.getByText('Choose File')).toBeInTheDocument()
    expect(screen.getByText('Select a CSV file to import sources')).toBeInTheDocument()
  })

  it('renders Import Sources heading', () => {
    renderComponent()

    expect(screen.getByText('Import Sources')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows error for non-CSV file', async () => {
    renderComponent()

    const file = new File(['data'], 'sources.txt', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Please select a CSV file')).toBeInTheDocument()
    })

    expect(mockParseCsvString).not.toHaveBeenCalled()
  })

  it('shows valid and error row counts in preview after file parsed', async () => {
    mockParseCsvString.mockReturnValue({
      valid: [
        { name: 'Reuters', bias: 'center', factuality: 'high', ownership: 'corporate', region: 'us' },
        { name: 'CNN', bias: 'left', factuality: 'mixed', ownership: 'corporate', region: 'us' },
      ],
      errors: [
        { row: 3, errors: ['Missing name field'] },
      ],
      totalRows: 3,
    })

    renderComponent()

    const file = createCsvFile('sources.csv', 'name,bias\nReuters,center\nCNN,left\n,bad')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // Simulate FileReader by triggering change
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('2 valid rows')).toBeInTheDocument()
    })

    expect(screen.getByText('1 errors')).toBeInTheDocument()
    expect(screen.getByText('3 total')).toBeInTheDocument()
  })

  it('calls importSources with valid rows on import', async () => {
    const validRows = [
      { name: 'Reuters', bias: 'center' as const, factuality: 'high' as const, ownership: 'corporate' as const, region: 'us' as const },
    ]
    mockParseCsvString.mockReturnValue({
      valid: validRows,
      errors: [],
      totalRows: 1,
    })

    renderComponent()

    const file = createCsvFile('sources.csv', 'name,bias\nReuters,center')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1 valid rows')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Import 1 sources'))

    await waitFor(() => {
      expect(mockImportSources).toHaveBeenCalledWith({ rows: validRows })
    })
  })

  it('shows import results with inserted, skipped, and error counts', async () => {
    mockImportSources.mockResolvedValue({
      success: true,
      data: {
        inserted: 2,
        skipped: 1,
        errors: [{ row: 3, reason: 'Duplicate slug' }],
      },
    })

    mockParseCsvString.mockReturnValue({
      valid: [
        { name: 'Reuters', bias: 'center', factuality: 'high', ownership: 'corporate', region: 'us' },
        { name: 'CNN', bias: 'left', factuality: 'mixed', ownership: 'corporate', region: 'us' },
        { name: 'Fox', bias: 'right', factuality: 'mixed', ownership: 'corporate', region: 'us' },
      ],
      errors: [],
      totalRows: 3,
    })

    renderComponent()

    const file = createCsvFile('sources.csv', 'csv-data')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import 3 sources')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Import 3 sources'))

    await waitFor(() => {
      expect(screen.getByText('Import Complete')).toBeInTheDocument()
    })

    expect(screen.getByText('2 inserted')).toBeInTheDocument()
    expect(screen.getByText('1 skipped (duplicates)')).toBeInTheDocument()
    expect(screen.getByText('1 errors')).toBeInTheDocument()
  })

  it('resets state when "Import another file" is clicked', async () => {
    mockImportSources.mockResolvedValue({
      success: true,
      data: { inserted: 1, skipped: 0, errors: [] },
    })

    mockParseCsvString.mockReturnValue({
      valid: [{ name: 'Reuters', bias: 'center', factuality: 'high', ownership: 'corporate', region: 'us' }],
      errors: [],
      totalRows: 1,
    })

    renderComponent()

    const file = createCsvFile('sources.csv', 'csv-data')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import 1 sources')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Import 1 sources'))

    await waitFor(() => {
      expect(screen.getByText('Import Complete')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Import another file'))

    // Should return to upload state
    await waitFor(() => {
      expect(screen.getByText('Choose File')).toBeInTheDocument()
    })

    expect(screen.queryByText('Import Complete')).not.toBeInTheDocument()
  })

  it('resets state when "Start over" is clicked in preview', async () => {
    mockParseCsvString.mockReturnValue({
      valid: [{ name: 'Reuters', bias: 'center', factuality: 'high', ownership: 'corporate', region: 'us' }],
      errors: [],
      totalRows: 1,
    })

    renderComponent()

    const file = createCsvFile('sources.csv', 'csv-data')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Start over')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Start over'))

    await waitFor(() => {
      expect(screen.getByText('Choose File')).toBeInTheDocument()
    })
  })
})
