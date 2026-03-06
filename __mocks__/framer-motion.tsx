import React from 'react'

const MOTION_TAGS = [
  'a', 'article', 'button', 'div', 'form',
  'h1', 'h2', 'h3', 'h4', 'img', 'li',
  'main', 'nav', 'p', 'section', 'span', 'ul',
] as const

type MotionProps = Record<string, unknown> & { children?: React.ReactNode }

function createMotionComponent(tag: string) {
  const Component = React.forwardRef<HTMLElement, MotionProps>(
    (
      {
        children,
        // Strip framer-motion-specific props
        animate: _animate,
        initial: _initial,
        exit: _exit,
        transition: _transition,
        variants: _variants,
        whileHover: _whileHover,
        whileTap: _whileTap,
        whileFocus: _whileFocus,
        whileInView: _whileInView,
        layout: _layout,
        layoutId: _layoutId,
        drag: _drag,
        dragConstraints: _dragConstraints,
        dragElastic: _dragElastic,
        onDrag: _onDrag,
        onDragEnd: _onDragEnd,
        onDragStart: _onDragStart,
        onAnimationComplete: _onAnimationComplete,
        onAnimationStart: _onAnimationStart,
        custom: _custom,
        ...props
      },
      ref,
    ) => React.createElement(tag, { ...props, ref }, children as React.ReactNode),
  )
  Component.displayName = `motion.${tag}`
  return Component
}

export const motion = Object.fromEntries(
  MOTION_TAGS.map((tag) => [tag, createMotionComponent(tag)]),
) as Record<string, ReturnType<typeof createMotionComponent>>

export function AnimatePresence({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

export function useAnimation() {
  return { start: () => Promise.resolve(), stop: () => {}, set: () => {} }
}

export const useMotionValue = (v: unknown) => ({ get: () => v, set: () => {} })
export const useSpring = (v: unknown) => ({ get: () => v, set: () => {} })
export const useTransform = () => ({ get: () => 0, set: () => {} })
