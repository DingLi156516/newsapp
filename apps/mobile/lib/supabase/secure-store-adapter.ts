/**
 * Expo SecureStore adapter for Supabase auth session persistence.
 * Implements the required getItem/setItem/removeItem interface.
 */

import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const KEY_PREFIX = 'supabase-auth-'

function getKey(key: string): string {
  // SecureStore keys can't contain certain chars; sanitize
  return `${KEY_PREFIX}${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`
}

export const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return null
    try {
      return await SecureStore.getItemAsync(getKey(key))
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return
    try {
      await SecureStore.setItemAsync(getKey(key), value)
    } catch {
      // SecureStore has a ~2048 byte limit per item.
      // If the session is too large, silently fail.
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return
    try {
      await SecureStore.deleteItemAsync(getKey(key))
    } catch {
      // Silently fail
    }
  },
}
