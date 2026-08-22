import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  declineLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void | Promise<void>;
  onDecline: () => void;
}

/**
 * Port of the web `ConfirmDialog` shared component, including its behaviour of
 * owning the in-flight state and auto-closing once `onConfirm` resolves.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  declineLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  onDecline,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      // The caller closes the dialog on success; resetting here keeps the
      // button usable if it stays open after a failure.
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onDecline}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        onPress={loading ? undefined : onDecline}
      >
        {/* Stops taps inside the card from dismissing the dialog. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.card,
            theme.shadows.lg,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius['2xl'],
              padding: theme.spacing['2xl'],
              gap: theme.spacing.md,
            },
          ]}
        >
          <Text variant="h2">{title}</Text>

          {description ? (
            <Text variant="small" color="mutedForeground">
              {description}
            </Text>
          ) : null}

          <View style={[styles.actions, { gap: theme.spacing.md }]}>
            <Button
              label={declineLabel}
              variant="outline"
              onPress={onDecline}
              disabled={loading}
              style={{ flex: 1 }}
            />
            <Button
              label={loading ? 'Processing…' : confirmLabel}
              variant={variant === 'destructive' ? 'destructive' : 'primary'}
              onPress={handleConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
