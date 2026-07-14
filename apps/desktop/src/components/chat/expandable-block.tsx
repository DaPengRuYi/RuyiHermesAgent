'use client'

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'

import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface ExpandableBlockProps {
  children: ReactNode
  className?: string
}

export function ExpandableBlock({ children, className }: ExpandableBlockProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const el = innerRef.current

    if (!el) {
      return
    }

    const measure = () => setOverflowing(el.scrollHeight > 121)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative min-h-48 w-full min-w-0">
      <div
        className={cn('overflow-y-auto', expanded ? 'max-h-[60dvh]' : 'h-48 max-h-48', className)}
        ref={innerRef}
      >
        {children}
      </div>
      {overflowing && (
        <button
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="absolute bottom-2 left-1/2 grid size-10 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-border/55 bg-(--ui-chat-surface-background)/90 text-muted-foreground/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setExpanded(v => !v)}
          type="button"
        >
          <ChevronDown className={cn('size-6 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
