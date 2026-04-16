/**
 * Theme foundation smoke test.
 *
 * Renders each of the 8 sentinel components under a non-default theme via
 * `ThemeProvider theme={...}` and asserts they don't crash. This is the
 * programmatic equivalent of the plan's manual simulator smoke test and
 * guards the architecture against future regressions.
 *
 * Deliberately does NOT test visual correctness — that belongs with a real
 * light/alternate theme once design specs exist.
 */

import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { ThemeProvider, darkTheme, useTheme } from '@/lib/shared/theme'
import type { Theme } from '@/lib/shared/theme'
import { GlassView } from '@/components/ui/GlassView'
import { Skeleton } from '@/components/atoms/Skeleton'
import { BookmarkButton } from '@/components/atoms/BookmarkButton'
import { ShareButton } from '@/components/atoms/ShareButton'
import { EmptyStateView } from '@/components/molecules/EmptyStateView'
import { CollapsibleSection } from '@/components/molecules/CollapsibleSection'
import { Toast } from '@/components/molecules/Toast'
import { NexusCard } from '@/components/organisms/NexusCard'
import { sampleArticles } from '@/lib/shared/sample-data'

const swappedTheme: Theme = {
  ...darkTheme,
  name: 'light',
  surface: {
    ...darkTheme.surface,
    background: '#ff00ff',
    glass: '#ff00ff',
    glassSm: '#ff00ff',
    glassPill: '#ff00ff',
    border: '#00ff00',
    borderPill: '#00ff00',
  },
  text: {
    primary: '#000000',
    secondary: '#111111',
    tertiary: '#222222',
    muted: '#333333',
  },
  blurTint: 'light',
  statusBarStyle: 'dark',
}

const sampleArticle = sampleArticles[0]

describe('theme foundation', () => {
  it('useTheme() returns darkTheme outside a provider', () => {
    let captured: Theme | undefined
    function Probe() {
      captured = useTheme()
      return <Text>probe</Text>
    }
    render(<Probe />)
    expect(captured).toBe(darkTheme)
  })

  it('useTheme() returns the provider-supplied theme', () => {
    let captured: Theme | undefined
    function Probe() {
      captured = useTheme()
      return <Text>probe</Text>
    }
    render(
      <ThemeProvider theme={swappedTheme}>
        <Probe />
      </ThemeProvider>,
    )
    expect(captured).toBe(swappedTheme)
  })

  describe('sentinels render under a swapped theme without crashing', () => {
    const sentinels: Array<[string, React.ReactElement]> = [
      ['GlassView', <GlassView key="g"><Text>glass</Text></GlassView>],
      ['Skeleton', <Skeleton key="s" width={100} height={12} />],
      [
        'BookmarkButton',
        <BookmarkButton key="b" isSaved={false} onPress={() => undefined} />,
      ],
      [
        'ShareButton',
        <ShareButton key="sh" url="/story/1" title="Example" />,
      ],
      [
        'EmptyStateView',
        <EmptyStateView key="e" message="Nothing here" title="Empty" />,
      ],
      [
        'CollapsibleSection',
        <CollapsibleSection key="c" title="Details">
          <Text>body</Text>
        </CollapsibleSection>,
      ],
      [
        'Toast',
        <Toast
          key="t"
          toast={{ id: '1', message: 'hello', variant: 'success' }}
          onDismiss={() => undefined}
        />,
      ],
      [
        'NexusCard',
        <NexusCard
          key="n"
          article={sampleArticle}
          isSaved={false}
          onSave={() => undefined}
          onClick={() => undefined}
        />,
      ],
    ]

    it.each(sentinels)('%s', (_name, element) => {
      expect(() =>
        render(<ThemeProvider theme={swappedTheme}>{element}</ThemeProvider>),
      ).not.toThrow()
    })
  })
})
