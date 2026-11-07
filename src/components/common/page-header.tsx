import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  subtitle?: React.ReactNode
  /** Shows a back button; pass a path or `true` for history back. */
  back?: string | boolean
  action?: React.ReactNode
  className?: string
}

/** Consistent page title row. Use one per screen (renders the page <h1>). */
export function PageHeader({ title, subtitle, back, action, className }: Props) {
  const navigate = useNavigate()
  return (
    <header className={cn('flex items-center gap-2 pb-4 pt-2', className)}>
      {back ? (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 size-11 shrink-0 rounded-full"
          aria-label="Go back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <ChevronLeft className="size-6" />
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
