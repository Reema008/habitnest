import { cn } from '@/lib/utils'

/** Frosted-glass container used for every card-like surface in the app. */
export function GlassCard({
  className,
  as: Tag = 'div',
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li' }) {
  return <Tag className={cn('glass rounded-2xl p-4', className)} {...props} />
}
