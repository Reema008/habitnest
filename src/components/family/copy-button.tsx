import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { copyToClipboard } from './family-utils'

/** Button that copies `text` and briefly shows a tick. */
export function CopyButton({
  text,
  label = 'Copy',
  successMessage = 'Copied',
  variant = 'secondary',
  className,
}: {
  text: string
  label?: string
  successMessage?: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      toast.success(successMessage)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Could not copy automatically — press and hold the text to copy it.')
    }
  }

  return (
    <Button type="button" variant={variant} className={cn('h-11 gap-2', className)} onClick={() => void onCopy()}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
