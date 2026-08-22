import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/api/client';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AuthProvider } from './AuthProvider';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // POS data changes as staff work; a short stale window keeps the
        // product grid current without hammering the API on every focus.
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // A 401 is handled by AuthProvider (session cleared); retrying a 4xx
          // just delays the inevitable.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

/**
 * The provider stack.
 *
 * Order matters: Theme is outermost so every provider below can read tokens;
 * Auth sits inside Query so hooks can invalidate caches on logout.
 *
 * React Query is adopted properly here — it is a dependency of the web app but
 * completely unused there, where every screen re-implements load/loading/error
 * inline and refetches whole lists after each mutation.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>{children}</AuthProvider>
            </QueryClientProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
