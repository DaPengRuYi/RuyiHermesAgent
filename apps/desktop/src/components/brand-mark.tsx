import { cn } from '@/lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// RuyiHermesAgent's "ruyi cloud core" mark. The source asset already contains its
// dark rounded tile and transparent safe area, so it works unchanged in both
// light and dark themes.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl',
        className
      )}
      {...props}
    >
      <img alt="" className="size-full object-contain" src={assetPath('ruyi-agent-logo.png')} />
    </span>
  )
}
