/**
 * Root layout — Loads fonts, wraps app in providers.
 */

import { useEffect } from 'react'
import { Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Stack, useRouter } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import * as NavigationBar from 'expo-navigation-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { AuthProvider } from '@/lib/auth/auth-provider'
import { SWRProvider } from '@/lib/hooks/swr-provider'
import { ToastContext, useToastProvider } from '@/lib/hooks/use-toast'
import { Toast } from '@/components/molecules/Toast'
import { useOnboarding } from '@/lib/hooks/use-onboarding'
import { ThemeProvider, useTheme, useThemeHydrated } from '@/lib/shared/theme'
import { PaperTextureOverlay } from '@/components/ui/PaperTextureOverlay'

import '@/global.css'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

function ThemedAppShell({ toastCtx }: { toastCtx: ReturnType<typeof useToastProvider> }) {
  const theme = useTheme()

  useEffect(() => {
    if (Platform.OS !== 'android') return
    NavigationBar.setBackgroundColorAsync(theme.surface.background).catch(() => {})
    NavigationBar.setButtonStyleAsync(theme.statusBarStyle).catch(() => {})
  }, [theme.surface.background, theme.statusBarStyle])

  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.surface.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="story/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="saved"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="history"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="guide"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <PaperTextureOverlay />
      {toastCtx.toast && <Toast toast={toastCtx.toast} onDismiss={toastCtx.dismissToast} />}
    </>
  )
}

function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useThemeHydrated()
  if (!hydrated) return null
  return <>{children}</>
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay: require('../assets/fonts/DMSerifDisplay-Regular.ttf'),
    Inter: require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  })

  const toastCtx = useToastProvider()
  const router = useRouter()
  const { hasSeenOnboarding } = useOnboarding()

  useEffect(() => {
    if (fontError) throw fontError
  }, [fontError])

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  useEffect(() => {
    if (fontsLoaded && hasSeenOnboarding === false) {
      router.replace('/onboarding')
    }
  }, [fontsLoaded, hasSeenOnboarding, router])

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider>
          <HydrationGate>
            <AuthProvider>
              <SWRProvider>
                <ToastContext.Provider value={toastCtx}>
                  <ThemedAppShell toastCtx={toastCtx} />
                </ToastContext.Provider>
              </SWRProvider>
            </AuthProvider>
          </HydrationGate>
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}
