/**
 * SearchBar — Controlled text input for searching articles.
 */

import { View, TextInput, Pressable } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { GlassView } from '@/components/ui/GlassView'
import { TEXT_OPACITY } from '@/lib/shared/design'

interface Props {
  readonly value: string
  readonly onChange: (v: string) => void
  readonly onClear: () => void
  readonly placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search stories...',
}: Props) {
  return (
    <GlassView
      variant="sm"
      style={{
        minHeight: 44,
        borderColor: 'rgba(255, 255, 255, 0.12)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, flex: 1 }}>
        <Search size={16} color={`rgba(255, 255, 255, ${TEXT_OPACITY.tertiary})`} />
        <TextInput
          testID="search-input"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          style={{
            flex: 1,
            fontFamily: 'Inter',
            fontSize: 14,
            color: 'white',
            paddingVertical: 12,
            paddingLeft: 8,
            paddingRight: 10,
          }}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <X size={14} color={`rgba(255, 255, 255, ${TEXT_OPACITY.tertiary})`} />
          </Pressable>
        )}
      </View>
    </GlassView>
  )
}
