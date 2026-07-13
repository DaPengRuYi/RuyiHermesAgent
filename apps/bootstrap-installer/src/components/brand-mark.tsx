import { cn } from '../lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// RuyiHermesAgent brand mark. The asset already includes its dark rounded tile, so
// the wrapper only clips and sizes it consistently across installer screens.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl', className)}
      {...props}
    >
      <img alt="" className="size-full object-contain" src={assetPath('ruyi-agent-logo.png')} />
    </span>
  )
}
