import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

const mockDismiss = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    dismiss: mockDismiss,
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    signInWithEmail: jest.fn().mockResolvedValue({ error: null }),
    signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
    signUpWithEmail: jest.fn().mockResolvedValue({ error: null }),
    signOut: jest.fn(),
    user: null,
    session: null,
    isLoading: false,
  }),
}))

import LoginScreen from '@/app/(auth)/login'

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the Axiom heading and tagline', () => {
    render(<LoginScreen />)
    expect(screen.getByText('Axiom')).toBeTruthy()
    expect(screen.getByText('See the Full Spectrum')).toBeTruthy()
  })

  it('renders Sign In text', () => {
    render(<LoginScreen />)
    expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(1)
  })

  it('renders email and password input fields', () => {
    render(<LoginScreen />)
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.getByText('Password')).toBeTruthy()
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy()
  })

  it('renders the Google OAuth button', () => {
    render(<LoginScreen />)
    expect(screen.getByText('Continue with Google')).toBeTruthy()
  })

  it('renders the Sign Up link', () => {
    render(<LoginScreen />)
    expect(screen.getByText('Sign Up')).toBeTruthy()
  })

  it('renders a close button that calls router.dismiss()', () => {
    render(<LoginScreen />)
    const closeButton = screen.getByTestId('close-button')
    fireEvent.press(closeButton)
    expect(mockDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders Skip for now that calls router.dismiss()', () => {
    render(<LoginScreen />)
    fireEvent.press(screen.getByText('Skip for now'))
    expect(mockDismiss).toHaveBeenCalledTimes(1)
  })

  it('allows typing in email and password fields', () => {
    render(<LoginScreen />)
    const emailInput = screen.getByPlaceholderText('you@example.com')
    fireEvent.changeText(emailInput, 'test@example.com')
    expect(emailInput.props.value).toBe('test@example.com')
  })
})
