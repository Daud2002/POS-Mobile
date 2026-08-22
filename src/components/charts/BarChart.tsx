import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface BarPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarPoint[];
  height?: number;
  formatValue?: (value: number) => string;
}

/**
 * Vertical bar chart.
 *
 * Plain views rather than SVG — bars are rectangles, and this way they inherit
 * the theme's border radius for free.
 */
export function BarChart({ data, height = 180, formatValue }: BarChartProps) {
  const theme = useTheme();
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height,
          gap: theme.spacing.sm,
        }}
      >
        {data.map((point) => (
          <View key={point.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            {/* Zero-value bars still get a 2px sliver so the axis reads as a row
                of columns rather than gaps. */}
            <View
              style={{
                width: '100%',
                height: Math.max(2, (point.value / max) * (height - 20)),
                backgroundColor:
                  point.value > 0 ? theme.colors.primary : theme.colors.muted,
                borderTopLeftRadius: theme.radius.sm,
                borderTopRightRadius: theme.radius.sm,
              }}
            />
            <Text variant="caption" color="mutedForeground" numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        ))}
      </View>

      {formatValue ? (
        <Text variant="caption" color="mutedForeground">
          Peak {formatValue(max)}
        </Text>
      ) : null}
    </View>
  );
}
