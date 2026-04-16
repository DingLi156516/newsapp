/**
 * Auth modal stack layout — Login and Signup screens.
 *
 * Modal screens render in a separate native view hierarchy, so the root
 * `PaperTextureOverlay` mounted in `_layout.tsx` does not paint here. Each
 * auth screen mounts its own `PaperTextureOverlay` as the first child of its
 * SafeAreaView so the paper grain is visible under the auth UI.
 */

import { Stack } from 'expo-router'
import { useTheme } from '@/lib/shared/theme'

export default function AuthLayout() {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  )
}
