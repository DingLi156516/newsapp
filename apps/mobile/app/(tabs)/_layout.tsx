/**
 * Bottom tab navigator — Home, Sources, Profile.
 */

import { Tabs } from 'expo-router'
import { Newspaper, Globe, User } from 'lucide-react-native'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 0.5,
          paddingBottom: 4,
        },
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
          tabBarTestID: 'tab-home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Newspaper size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sources"
        options={{
          title: 'Sources',
          tabBarTestID: 'tab-sources',
          tabBarAccessibilityLabel: 'Sources',
          tabBarIcon: ({ color, size }) => (
            <Globe size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarTestID: 'tab-profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
