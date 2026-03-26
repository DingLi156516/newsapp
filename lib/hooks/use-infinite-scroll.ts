import { useEffect, useRef } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { enabled: boolean; isLoading: boolean }
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!options.enabled || options.isLoading) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [onLoadMore, options.enabled, options.isLoading])

  return sentinelRef
}
