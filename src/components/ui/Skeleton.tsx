import { useEffect } from 'react';
import { DimensionValue, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** A single pulsing placeholder block. */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.muted,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Card-shaped placeholder used while lists load. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
      }}
    >
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '40%' : '85%'} height={12} />
      ))}
    </View>
  );
}

/** Repeats a card skeleton — the standard list loading state. */
export function SkeletonList({ count = 5, lines = 2 }: { count?: number; lines?: number }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} lines={lines} />
      ))}
    </View>
  );
}
