import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BiasLegend } from '@/components/molecules/BiasLegend'
import { BIAS_LABELS } from '@/lib/types'

describe('BiasLegend', () => {
  it('renders all 7 bias labels', () => {
    render(<BiasLegend onClose={vi.fn()} />)
    Object.values(BIAS_LABELS).forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('renders 7 pattern swatches (aria-hidden spans)', () => {
    const { container } = render(<BiasLegend onClose={vi.fn()} />)
    const swatches = container.querySelectorAll('span[aria-hidden="true"]')
    expect(swatches).toHaveLength(7)
  })

  it('close button (×) calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BiasLegend onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close legend' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click outside the legend calls onClose', () => {
    const onClose = vi.fn()
    render(
      <div>
        <BiasLegend onClose={onClose} />
        <div data-testid="outside">outside</div>
      </div>,
    )
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click inside the legend does NOT call onClose', () => {
    const onClose = vi.fn()
    render(<BiasLegend onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })
})
