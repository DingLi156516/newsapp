import { View, Text } from 'react-native'
import { WifiOff } from 'lucide-react-native'
import { useOnline } from '@/lib/hooks/use-online'

export function OfflineIndicator() {
  const isOnline = useOnline()

  if (isOnline) return null

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    }}>
      <WifiOff size={12} color="#f59e0b" />
      <Text style={{ fontFamily: 'Inter', fontSize: 11, color: '#f59e0b' }}>Offline</Text>
    </View>
  )
}
