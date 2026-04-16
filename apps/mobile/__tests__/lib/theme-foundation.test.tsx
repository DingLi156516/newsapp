/**
 * Theme foundation smoke test.
 *
 * Renders each of the 8 sentinel components under both shipped themes via
 * `ThemeProvider theme={...}` and asserts they don't crash. Catches the most
 * common regression: a `useTheme()` consumer that crashes when given a theme
 * other than dark (e.g. references a removed token).
 */

import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { ThemeProvider, darkTheme, paperTheme, useTheme } from '@/lib/shared/theme'
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
      <ThemeProvider theme={paperTheme}>
        <Probe />
      </ThemeProvider>,
    )
    expect(captured).toBe(paperTheme)
  })

  describe.each([
    ['darkTheme', darkTheme],
    ['paperTheme', paperTheme],
  ])('sentinels render under %s without crashing', (_name, theme) => {
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

    it.each(sentinels)('%s', (_sentinelName, element) => {
      expect(() =>
        render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
      ).not.toThrow()
    })
  })
})
