/**
 * Bottom tab navigator — Home, Sources, Blindspot, Profile.
 * Glassmorphic blur background with active glow indicator + haptic feedback.
 */

import { StyleSheet, View } from 'react-native'
import { Tabs } from 'expo-router'
import { BlurView } from 'expo-blur'
import { Newspaper, Globe, Eye, User } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'
import { useTheme } from '@/lib/shared/theme'

function TabBarBackground() {
  const theme = useTheme()
  return (
    <BlurView intensity={25} tint={theme.blurTint} style={StyleSheet.absoluteFill}>
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: theme.surface.glass,
        }}
      />
    </BlurView>
  )
}

function TabIcon({ Icon, color, size, focused }: {
  Icon: typeof Newspaper
  color: string
  size: number
  focused: boolean
}) {
  const theme = useTheme()
  return (
    <View style={styles.iconWrapper}>
      {focused && (
        <View
          style={[styles.activeGlow, { backgroundColor: `rgba(${theme.inkRgb}, 0.06)` }]}
        />
      )}
      <Icon size={size} color={color} />
    </View>
  )
}

export default function TabLayout() {
  const theme = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0.5,
          borderTopColor: theme.surface.border,
          elevation: 0,
          paddingBottom: 4,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: theme.text.primary,
        tabBarInactiveTintColor: theme.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Newspaper} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => hapticLight() }}
      />
      <Tabs.Screen
        name="sources"
        options={{
          title: 'Sources',
          tabBarButtonTestID: 'tab-sources',
          tabBarAccessibilityLabel: 'Sources',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Globe} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => hapticLight() }}
      />
      <Tabs.Screen
        name="blindspot"
        options={{
          title: 'Blindspot',
          tabBarButtonTestID: 'tab-blindspot',
          tabBarAccessibilityLabel: 'Blindspot',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Eye} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => hapticLight() }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={User} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => hapticLight() }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 28,
  },
  activeGlow: {
    position: 'absolute',
    width: 36,
    height: 24,
    borderRadius: 12,
  },
})
