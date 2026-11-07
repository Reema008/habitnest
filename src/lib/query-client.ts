import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep cached reads for offline viewing
      retry: (count, error) => count < 2 && !/permission|not found/i.test(String((error as Error)?.message)),
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Writes need the network; failures surface as friendly toasts.
      networkMode: 'online',
      retry: 0,
    },
  },
})

/** Persists the read cache to localStorage so the installed app shows data offline. */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'habitnest-query-cache',
  throttleTime: 2000,
})
