import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ColorName } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface KeyValueRowProps {
  label: string;
  value: string;
  /** Renders the value in `bodySemibold` — for totals. */
  emphasis?: boolean;
  valueColor?: ColorName;
}

/** Label-left / value-right row, used in every order and invoice summary. */
export function KeyValueRow({
  label,
  value,
  emphasis = false,
  valueColor = 'foreground',
}: KeyValueRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: theme.spacing.xs }]}>
      <Text variant={emphasis ? 'bodySemibold' : 'small'} color="mutedForeground">
        {label}
      </Text>
      <Text variant={emphasis ? 'money' : 'smallMedium'} color={valueColor}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
