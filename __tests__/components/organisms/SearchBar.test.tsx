import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/organisms/SearchBar'

describe('SearchBar', () => {
  it('renders placeholder text', () => {
    render(<SearchBar value="" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(
      screen.getByPlaceholderText('Search stories, topics, sources…'),
    ).toBeInTheDocument()
  })

  it('renders custom placeholder text', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        onClear={vi.fn()}
        placeholder="Search here"
      />,
    )
    expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument()
  })

  it('clear (×) button is hidden when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('clear (×) button is visible when value is non-empty', () => {
    render(<SearchBar value="climate" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })

  it('typing in the input calls onChange with the new value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar value="" onChange={onChange} onClear={vi.fn()} />)
    const input = screen.getByRole('searchbox')
    await user.type(input, 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('clicking clear button calls onClear', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar value="test" onChange={vi.fn()} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
