/**
 * Mobile SWR fetcher — prepends API base URL and adds Bearer token.
 *
 * In Expo Go, localhost is unreachable (the phone is a different device).
 * We auto-detect the Mac's LAN IP from the Expo debugger host so the app
 * can reach the Next.js dev server without manual configuration.
 */

import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase/client'

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

  if (__DEV__ && envUrl.includes('localhost')) {
    const debuggerHost =
      Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost
    if (debuggerHost) {
      const lanIp = debuggerHost.split(':')[0]
      return envUrl.replace('localhost', lanIp)
    }
  }

  return envUrl
}

const API_BASE_URL = getApiBaseUrl()

export async function fetcher<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Attach Bearer token if authenticated
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(fullUrl, { headers })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

/**
 * Authenticated fetch helper for non-GET requests (POST, PATCH, DELETE).
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return fetch(fullUrl, { ...options, headers })
}
