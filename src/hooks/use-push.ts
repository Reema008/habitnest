import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPushStatus, listMyPushDevices, showTestNotification, subscribe, unsubscribe } from '@/api/push'
import { queryKeys } from '@/lib/query-keys'
import { useAuth } from '@/providers/auth-provider'

const statusKey = [...queryKeys.push.subscriptions, 'status'] as const
const devicesKey = [...queryKeys.push.subscriptions, 'devices'] as const

/** Push state of *this* device (supported / permission / subscribed). */
export function usePushStatus() {
  return useQuery({
    queryKey: statusKey,
    queryFn: getPushStatus,
    // Mostly local browser state: never wait for the network to answer.
    networkMode: 'always',
    staleTime: 0,
  })
}

/** All of my devices that receive reminders. */
export function usePushDevices() {
  const { userId } = useAuth()
  return useQuery({ queryKey: devicesKey, queryFn: () => listMyPushDevices(userId!), enabled: !!userId })
}

function useInvalidatePush() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.push.subscriptions })
}

export function useEnablePush() {
  const invalidate = useInvalidatePush()
  return useMutation({ mutationFn: subscribe, onSettled: invalidate })
}

export function useDisablePush() {
  const invalidate = useInvalidatePush()
  return useMutation({ mutationFn: unsubscribe, onSettled: invalidate })
}

export function useTestNotification() {
  return useMutation({ mutationFn: showTestNotification, networkMode: 'always' })
}
