import { Link, Stack } from 'expo-router'
import { View, Text } from 'react-native'
import { useTheme } from '@/lib/shared/theme'

export default function NotFoundScreen() {
  const theme = useTheme()
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.background }}>
        <Text style={{ color: theme.text.primary, fontSize: 18, marginBottom: 16 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/" style={{ color: theme.text.secondary }}>
          Go to home screen
        </Link>
      </View>
    </>
  )
}
