import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 3200;
const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

/**
 * In-app toast host.
 *
 * The web app mixes sonner AND the shadcn toast store; mobile consolidates on
 * one theme-aware implementation so success/error styling is consistent.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, tone, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      warning: (message) => push('warning', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.viewport, { top: insets.top + theme.spacing.sm, gap: theme.spacing.sm }]}
    >
      {toasts.map((toast) => {
        const color =
          toast.tone === 'success'
            ? theme.colors.success
            : toast.tone === 'error'
              ? theme.colors.destructive
              : toast.tone === 'warning'
                ? theme.colors.warning
                : theme.colors.info;
        const Icon = ICONS[toast.tone];

        return (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.duration(200)}
            exiting={FadeOutUp.duration(160)}
            style={[
              styles.toast,
              theme.shadows.lg,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.lg,
                borderColor: theme.tint(color, 0.35),
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                gap: theme.spacing.md,
              },
            ]}
          >
            <Icon size={18} color={color} />
            <Text variant="smallMedium" style={{ flex: 1 }}>
              {toast.message}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Toast API. Replaces `toast.success(...)` / `toast.error(...)` from sonner. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
