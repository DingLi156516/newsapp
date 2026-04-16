/**
 * SearchBar — Controlled text input for searching articles.
 */

import { View, TextInput, Pressable } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'

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
  const theme = useTheme()
  return (
    <GlassView
      variant="sm"
      style={{
        minHeight: 44,
        borderColor: theme.surface.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, flex: 1 }}>
        <Search size={16} color={theme.text.tertiary} />
        <TextInput
          testID="search-input"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.text.tertiary}
          keyboardAppearance={theme.name === 'paper' ? 'light' : 'dark'}
          style={{
            flex: 1,
            fontFamily: 'Inter',
            fontSize: 14,
            color: theme.text.primary,
            paddingVertical: 12,
            paddingLeft: 8,
            paddingRight: 10,
          }}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <X size={14} color={theme.text.tertiary} />
          </Pressable>
        )}
      </View>
    </GlassView>
  )
}
