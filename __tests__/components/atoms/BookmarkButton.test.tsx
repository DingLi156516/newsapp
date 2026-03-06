import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'

vi.mock('framer-motion')

describe('BookmarkButton', () => {
  it('unsaved state: aria-pressed="false", aria-label="Bookmark story"', () => {
    render(<BookmarkButton isSaved={false} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Bookmark story' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('saved state: aria-pressed="true", aria-label="Remove bookmark"', () => {
    render(<BookmarkButton isSaved={true} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Remove bookmark' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('click calls onToggle exactly once', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<BookmarkButton isSaved={false} onToggle={onToggle} />)
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('click does not propagate to parent element', async () => {
    const onToggle = vi.fn()
    const parentClick = vi.fn()
    const user = userEvent.setup()
    render(
      <div onClick={parentClick}>
        <BookmarkButton isSaved={false} onToggle={onToggle} />
      </div>,
    )
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders a button element', () => {
    render(<BookmarkButton isSaved={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
