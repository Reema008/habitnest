import { useRef } from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { Bell, BellRing, CheckCheck, ChevronRight, Flag, KeyRound, Trash2, Trophy, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion, type PanInfo } from 'motion/react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications,
} from '@/hooks/use-notifications'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types/models'
import { notificationLink } from './notification-link'

const SWIPE_DELETE_PX = 110

function kindVisual(kind: string): { icon: LucideIcon; bg: string } {
  if (kind.startsWith('badge') || kind.includes('achievement')) return { icon: Trophy, bg: 'bg-lemon' }
  if (kind.startsWith('challenge')) return { icon: Flag, bg: 'bg-mint' }
  if (kind === 'member_joined') return { icon: UserPlus, bg: 'bg-sky' }
  if (kind === 'password_reset') return { icon: KeyRound, bg: 'bg-peach' }
  if (kind.includes('reminder')) return { icon: BellRing, bg: 'bg-rose' }
  return { icon: Bell, bg: 'bg-lavender' }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

function NotificationItem({
  n,
  online,
  onOpen,
  onDelete,
}: {
  n: AppNotification
  online: boolean
  onOpen: (n: AppNotification) => void
  onDelete: (n: AppNotification) => void
}) {
  const reduceMotion = useReducedMotion()
  const unread = !n.read_at
  const link = notificationLink(n)
  const { icon: Icon, bg } = kindVisual(n.kind)

  // A swipe must not also count as a tap on the card.
  const dragged = useRef(false)
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (online && info.offset.x < -SWIPE_DELETE_PX) onDelete(n)
    setTimeout(() => {
      dragged.current = false
    }, 0)
  }

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Revealed while swiping left. */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-end rounded-2xl bg-destructive pr-6 text-white">
        <Trash2 className="size-5" />
      </div>
      <motion.div
        drag={online ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={onDragEnd}
        transition={reduceMotion ? { duration: 0 } : undefined}
        className={cn(
          'glass relative flex items-stretch rounded-2xl',
          unread && 'bg-lavender/60 ring-2 ring-primary/30 dark:bg-lavender/25',
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (!dragged.current) onOpen(n)
          }}
          className="flex min-h-16 min-w-0 flex-1 items-start gap-3 rounded-2xl p-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-xl', bg)}>
            <Icon className="size-5 text-foreground/80" aria-hidden />
            {unread ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-background" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block leading-snug', unread ? 'font-bold' : 'font-semibold')}>
              {unread ? <span className="sr-only">Unread: </span> : null}
              {n.title}
            </span>
            {n.body ? <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span> : null}
            <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
          </span>
          {link ? <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="m-1 size-11 shrink-0 self-center rounded-full text-muted-foreground hover:text-destructive"
          aria-label={`Delete notification: ${n.title}`}
          disabled={!online}
          onClick={() => onDelete(n)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </motion.div>
    </li>
  )
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const query = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const remove = useDeleteNotification()

  const unreadCount = query.data?.filter((n) => !n.read_at).length ?? 0

  const onOpen = (n: AppNotification) => {
    if (!n.read_at && online) {
      markRead.mutate(n.id, { onError: (e) => toast.error(toUserMessage(e)) })
    }
    const link = notificationLink(n)
    if (link) navigate(link)
  }

  const onDelete = (n: AppNotification) =>
    remove.mutate(n.id, {
      onSuccess: () => toast.success('Notification deleted'),
      onError: (e) => toast.error(toUserMessage(e)),
    })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : query.data?.length ? 'All caught up' : undefined}
        back="/home"
        action={
          query.data && query.data.length > 0 ? (
            <Button
              variant="secondary"
              className="h-11"
              disabled={!online || unreadCount === 0 || markAll.isPending}
              onClick={() =>
                markAll.mutate(undefined, {
                  onSuccess: () => toast.success('All caught up'),
                  onError: (e) => toast.error(toUserMessage(e)),
                })
              }
            >
              <CheckCheck className="size-4" aria-hidden /> Mark all read
            </Button>
          ) : null
        }
      />

      {query.isPending ? (
        <LoadingState rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Badges, family challenges and other news will show up here."
        />
      ) : (
        <>
          <ul className="space-y-2" aria-label="Notifications">
            {query.data.map((n) => (
              <NotificationItem key={n.id} n={n} online={online} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </ul>
          <p className="text-center text-xs text-muted-foreground">
            {online ? 'Tip: swipe a notification left to delete it.' : 'Reconnect to mark notifications read or delete them.'}
          </p>
        </>
      )}
    </div>
  )
}
