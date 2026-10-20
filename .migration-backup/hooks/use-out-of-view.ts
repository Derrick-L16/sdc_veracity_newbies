'use client'

import { useEffect, useState, type RefObject } from 'react'

/** True once the element has scrolled above the top of its scroll root (offset for sticky headers). */
export function useOutOfView(
  ref: RefObject<HTMLElement | null>,
  { root, topOffset = 64 }: { root?: RefObject<HTMLElement | null>; topOffset?: number } = {},
) {
  const [out, setOut] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setOut(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + topOffset),
      { root: root?.current ?? null, rootMargin: `-${topOffset}px 0px 0px 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, root, topOffset])

  return out
}
