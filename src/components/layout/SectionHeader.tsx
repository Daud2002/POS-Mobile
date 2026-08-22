import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Gradient } from '@/components/ui/Gradient';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned control. */
  action?: ReactNode;
}

/**
 * Page header: a vertical gradient tick against the title, display-weight type,
 * muted subtitle. The tick is the brand accent that keeps ten different pages
 * reading as one product.
 */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.md }]}>
      <Gradient
        variant="primary"
        style={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 2,
          marginVertical: 2,
        }}
      />

      <View style={{ flex: 1 }}>
        <Text variant="display">{title}</Text>
        {subtitle ? (
          <Text
            variant="small"
            color="mutedForeground"
            style={{ marginTop: theme.spacing.xxs }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
