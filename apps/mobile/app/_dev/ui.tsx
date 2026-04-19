/**
 * Dev-only UI showcase — renders every `@/lib/ui` primitive and composed
 * component on one scrollable screen for manual review against both themes.
 *
 * Gated on `__DEV__`: in production builds, the route redirects home so
 * shipped apps don't expose the route.
 */

import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Redirect } from 'expo-router'
import { Bell, BookOpen, Eye, Settings, SlidersHorizontal } from 'lucide-react-native'
import {
  Button,
  Divider,
  Heading,
  IconButton,
  Pill,
  ScreenHeader,
  Section,
  SegmentedControl,
  StatCard,
  Surface,
  Text,
  TEXT_STYLES,
  SPACING,
  type TextVariant,
} from '@/lib/ui'
import { useSetTheme, useTheme } from '@/lib/shared/theme'
import type { ThemeName } from '@/lib/shared/theme'

const TEXT_VARIANTS: readonly TextVariant[] = [
  'hero',
  'display',
  'title',
  'heading',
  'headingSm',
  'body',
  'bodySm',
  'caption',
  'small',
  'overline',
  'badge',
]

const THEME_OPTIONS: readonly { value: ThemeName; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'paper', label: 'Paper' },
]

export default function UIShowcaseScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />
  }
  return <Showcase />
}

function Showcase() {
  const theme = useTheme()
  const setTheme = useSetTheme()
  const [sortMode, setSortMode] = useState<'name' | 'bias' | 'factuality'>('name')
  const [activeFilter, setActiveFilter] = useState<'all' | 'politics'>('all')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xxl * 2, gap: SPACING.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="UI Kit"
          subtitle="Editorial Glass — tokens, primitives, composed."
          leading={<Eye size={22} color={theme.text.primary} />}
          trailing={[
            <IconButton
              key="settings"
              icon={Settings}
              onPress={() => {}}
              accessibilityLabel="Settings"
            />,
            <IconButton
              key="filters"
              icon={SlidersHorizontal}
              onPress={() => {}}
              accessibilityLabel="Filters"
              badge={3}
            />,
          ]}
        />

        <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.lg }}>
          <Section label="Theme switch">
            <SegmentedControl
              value={theme.name}
              onChange={setTheme}
              options={THEME_OPTIONS}
            />
          </Section>

          <Divider />

          <Section label="Typography">
            <View style={{ gap: SPACING.sm }}>
              {TEXT_VARIANTS.map((variant) => (
                <View key={variant} style={{ gap: 2 }}>
                  <Text variant="overline" tone="muted">
                    {variant} · {TEXT_STYLES[variant].fontSize}/{TEXT_STYLES[variant].lineHeight}
                  </Text>
                  <Text variant={variant}>The quick brown fox jumps</Text>
                </View>
              ))}
            </View>
          </Section>

          <Divider />

          <Section label="Tones">
            <View style={{ gap: SPACING.xs }}>
              <Text tone="primary">Primary text</Text>
              <Text tone="secondary">Secondary text</Text>
              <Text tone="tertiary">Tertiary text</Text>
              <Text tone="muted">Muted text</Text>
              <Text tone="accent">Accent text</Text>
            </View>
          </Section>

          <Divider />

          <Section label="Stat cards">
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <StatCard value={127} label="Stories Read" />
              <StatCard value={12} label="This Session" />
              <StatCard value={3} label="Blindspots" glow={theme.semantic.warning.color} />
            </View>
          </Section>

          <Divider />

          <Section label="Pills">
            <View style={{ flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }}>
              <Pill label="All" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
              <Pill label="Politics" active={activeFilter === 'politics'} onPress={() => setActiveFilter('politics')} />
              <Pill label="Right-skew" dismissible onPress={() => {}} />
              <Pill label="Disabled" disabled />
            </View>
          </Section>

          <Divider />

          <Section label="SegmentedControl">
            <SegmentedControl
              value={sortMode}
              onChange={setSortMode}
              options={[
                { value: 'name', label: 'A–Z' },
                { value: 'bias', label: 'Bias' },
                { value: 'factuality', label: 'Factuality' },
              ]}
            />
          </Section>

          <Divider />

          <Section label="Buttons">
            <View style={{ gap: SPACING.sm }}>
              <Button onPress={() => {}} icon={BookOpen}>
                Primary action
              </Button>
              <Button variant="secondary" onPress={() => {}}>
                Secondary action
              </Button>
              <Button variant="destructive" icon={Bell} onPress={() => {}}>
                Destructive
              </Button>
              <Button variant="ghost" onPress={() => {}}>
                Ghost
              </Button>
              <Button variant="primary" loading onPress={() => {}}>
                Submitting…
              </Button>
            </View>
          </Section>

          <Divider />

          <Section label="Surfaces">
            <View style={{ gap: SPACING.sm }}>
              <Surface style={{ padding: SPACING.md }}>
                <Text>Glass surface (default)</Text>
              </Surface>
              <Surface variant="glassSm" elevation="sm" style={{ padding: SPACING.md }}>
                <Text>glassSm + sm elevation</Text>
              </Surface>
              <Surface
                variant="glassSm"
                elevation="sm"
                accent={theme.semantic.warning.color}
                style={{ padding: SPACING.md }}
              >
                <Text>glassSm + warning accent</Text>
              </Surface>
              <Surface variant="solid" elevation="md" style={{ padding: SPACING.md }}>
                <Text>Solid surface + md elevation</Text>
              </Surface>
            </View>
          </Section>

          <Divider />

          <Section label="Headings">
            <View style={{ gap: SPACING.xs }}>
              <Heading variant="hero">Hero headline</Heading>
              <Heading variant="display">Display title</Heading>
              <Heading variant="title">Card title</Heading>
            </View>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
