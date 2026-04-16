/**
 * Bottom tab navigator — Home, Sources, Profile.
 * Glassmorphic blur background with active glow indicator + haptic feedback.
 */

import { StyleSheet, View } from 'react-native'
import { Tabs } from 'expo-router'
import { BlurView } from 'expo-blur'
import { Newspaper, Globe, User } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'

function TabBarBackground() {
  return (
    <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill}>
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(10, 10, 10, 0.7)',
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
  return (
    <View style={styles.iconWrapper}>
      {focused && <View style={styles.activeGlow} />}
      <Icon size={size} color={color} />
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          elevation: 0,
          paddingBottom: 4,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
})
