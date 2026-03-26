import { Link, Stack } from 'expo-router'
import { View, Text } from 'react-native'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 16 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Go to home screen
        </Link>
      </View>
    </>
  )
}
