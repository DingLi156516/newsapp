import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

let mockUser: { id: string } | null = null
const mockMutate = jest.fn()

jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

jest.mock('swr', () => {
  const actual = jest.requireActual('swr')
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockMutate }),
    SWRConfig: ({ children }: { children: React.ReactNode }) => children,
  }
})

jest.mock('@/lib/hooks/fetcher', () => ({
  fetcher: jest.fn(),
}))

import { SWRProvider } from '@/lib/hooks/swr-provider'

describe('AuthRevalidator (inside SWRProvider)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = null
  })

  it('calls mutate when user changes from null to logged-in', async () => {
    const { rerender } = render(
      <SWRProvider><Text>child</Text></SWRProvider>
    )

    // Initial render with null user triggers mutate (prevUser null → null is same, no call)
    // But the first render sets prevUser to null
    mockMutate.mockClear()

    // Simulate login
    mockUser = { id: 'user-1' }
    rerender(<SWRProvider><Text>child</Text></SWRProvider>)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })

  it('calls mutate when user changes from logged-in to null (logout)', async () => {
    mockUser = { id: 'user-1' }
    const { rerender } = render(
      <SWRProvider><Text>child</Text></SWRProvider>
    )

    mockMutate.mockClear()

    // Simulate logout
    mockUser = null
    rerender(<SWRProvider><Text>child</Text></SWRProvider>)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })
})
