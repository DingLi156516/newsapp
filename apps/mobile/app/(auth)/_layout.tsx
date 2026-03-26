/**
 * Auth modal stack layout — Login and Signup screens.
 */

import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  )
}
