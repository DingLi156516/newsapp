import { render, screen } from '@testing-library/react'
import { NexusCardSkeleton, NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'

describe('NexusCardSkeleton', () => {
  it('renders skeleton card with loading status elements', () => {
    render(<NexusCardSkeleton />)
    const statuses = screen.getAllByRole('status')
    expect(statuses.length).toBeGreaterThan(0)
  })

  it('renders loading aria label on first skeleton', () => {
    render(<NexusCardSkeleton />)
    expect(screen.getByLabelText('Loading story')).toBeInTheDocument()
  })
})

describe('NexusCardSkeletonList', () => {
  it('renders default 3 skeleton cards', () => {
    render(<NexusCardSkeletonList />)
    const skeletons = screen.getAllByRole('status')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders custom count', () => {
    render(<NexusCardSkeletonList count={5} />)
    const skeletons = screen.getAllByRole('status')
    expect(skeletons.length).toBeGreaterThanOrEqual(5)
  })

  it('renders list layout by default (single column)', () => {
    const { container } = render(<NexusCardSkeletonList count={3} />)
    const grid = container.firstChild as HTMLElement
    expect(grid).not.toHaveClass('sm:grid-cols-2')
  })

  it('renders bento layout with 2 columns', () => {
    const { container } = render(<NexusCardSkeletonList count={4} layout="bento" />)
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveClass('sm:grid-cols-2')
  })
})
