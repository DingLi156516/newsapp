import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useLocalBookmarks,
  readLocalBookmarks,
  clearLocalBookmarks,
} from '@/lib/hooks/use-local-bookmarks'

const STORAGE_KEY = '@axiom/local_bookmarks'

describe('useLocalBookmarks', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('loads empty set when no stored data', async () => {
    const { result } = renderHook(() => useLocalBookmarks())

    // Wait for async load
    await act(async () => {})

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.localIds.size).toBe(0)
  })

  it('loads existing bookmarks from AsyncStorage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['story-1', 'story-2']))

    const { result } = renderHook(() => useLocalBookmarks())

    await act(async () => {})

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.localIds.has('story-1')).toBe(true)
    expect(result.current.localIds.has('story-2')).toBe(true)
    expect(result.current.localIds.size).toBe(2)
  })

  it('addLocal adds a story id and persists', async () => {
    const { result } = renderHook(() => useLocalBookmarks())

    await act(async () => {})

    act(() => {
      result.current.addLocal('story-new')
    })

    expect(result.current.localIds.has('story-new')).toBe(true)

    // Verify persistence
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(stored)).toContain('story-new')
  })

  it('removeLocal removes a story id and persists', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['story-1', 'story-2']))

    const { result } = renderHook(() => useLocalBookmarks())

    await act(async () => {})

    act(() => {
      result.current.removeLocal('story-1')
    })

    expect(result.current.localIds.has('story-1')).toBe(false)
    expect(result.current.localIds.has('story-2')).toBe(true)

    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(stored)).not.toContain('story-1')
  })

  it('clearLocal empties all bookmarks', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['story-1', 'story-2']))

    const { result } = renderHook(() => useLocalBookmarks())

    await act(async () => {})

    act(() => {
      result.current.clearLocal()
    })

    expect(result.current.localIds.size).toBe(0)

    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    expect(stored).toBeNull()
  })

  it('handles corrupted storage data gracefully', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'not-valid-json{{{')

    const { result } = renderHook(() => useLocalBookmarks())

    await act(async () => {})

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.localIds.size).toBe(0)
  })
})

describe('readLocalBookmarks', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('returns empty set when no data', async () => {
    const ids = await readLocalBookmarks()
    expect(ids.size).toBe(0)
  })

  it('returns stored bookmark ids', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['s1', 's2']))
    const ids = await readLocalBookmarks()
    expect(ids.has('s1')).toBe(true)
    expect(ids.has('s2')).toBe(true)
  })
})

describe('clearLocalBookmarks', () => {
  it('removes the storage key', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['s1']))
    await clearLocalBookmarks()
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    expect(stored).toBeNull()
  })
})
