import { X } from 'lucide-react-native';
import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Pinned to the bottom, outside the scroll area — for Save/Cancel rows. */
  footer?: ReactNode;
  /** Fraction of screen height the sheet may occupy. */
  maxHeightRatio?: number;
  /** Disable when the body manages its own scrolling (e.g. a FlatList). */
  scrollable?: boolean;
}

/**
 * Bottom sheet used for every form and picker — the mobile replacement for the
 * web app's Radix dialogs (product form, category form, customer picker,
 * payment method, employee form).
 *
 * Built on RN's Modal rather than a gesture-driven sheet because these are
 * text-entry forms, where predictable keyboard avoidance matters more than
 * drag-to-dismiss.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxHeightRatio = 0.9,
  scrollable = true,
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Tapping the scrim dismisses; the sheet itself sits below it. */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View
            style={[
              styles.sheet,
              theme.shadows.lg,
              {
                backgroundColor: theme.colors.card,
                borderTopLeftRadius: theme.radius['2xl'],
                borderTopRightRadius: theme.radius['2xl'],
                maxHeight: height * maxHeightRatio,
                paddingBottom: insets.bottom + theme.spacing.lg,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

            <View
              style={[
                styles.header,
                {
                  paddingHorizontal: theme.spacing.xl,
                  paddingBottom: theme.spacing.md,
                  gap: theme.spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="h2">{title}</Text>
                {description ? (
                  <Text
                    variant="small"
                    color="mutedForeground"
                    style={{ marginTop: theme.spacing.xs }}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>

              <IconButton accessibilityLabel="Close" onPress={onClose}>
                <X size={18} color={theme.colors.mutedForeground} />
              </IconButton>
            </View>

            {scrollable ? (
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: theme.spacing.xl,
                  paddingBottom: theme.spacing.lg,
                  gap: theme.spacing.lg,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={{
                  flex: 1,
                  paddingHorizontal: theme.spacing.xl,
                  paddingBottom: theme.spacing.lg,
                }}
              >
                {children}
              </View>
            )}

            {footer ? (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.colors.border,
                    paddingHorizontal: theme.spacing.xl,
                    paddingTop: theme.spacing.lg,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  keyboardView: { justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  footer: { flexDirection: 'row', borderTopWidth: 1 },
});
