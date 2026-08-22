import { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Text } from './Text';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/** Replaces the web app's `colSpan` "No X found." table rows. */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['4xl'],
        paddingHorizontal: theme.spacing['2xl'],
        gap: theme.spacing.sm,
      }}
    >
      {icon ? <View style={{ marginBottom: theme.spacing.sm }}>{icon}</View> : null}

      <Text variant="h3" align="center">
        {title}
      </Text>

      {description ? (
        <Text variant="small" color="mutedForeground" align="center">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="sm"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </View>
  );
}
