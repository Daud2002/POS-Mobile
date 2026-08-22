import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
}

/**
 * Donut chart with a legend — used for the payment-method breakdown.
 *
 * Drawn as a single circle per slice using stroke-dasharray offsets, which is
 * far less code than computing arc paths and renders identically.
 */
export function DonutChart({ data, size = 160, thickness = 22 }: DonutChartProps) {
  const theme = useTheme();

  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.muted}
          strokeWidth={thickness}
          fill="none"
        />

        {total > 0 &&
          data.map((slice) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const element = (
              <Circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                // Start at 12 o'clock rather than 3 o'clock.
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += dash;
            return element;
          })}
      </Svg>

      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        {data.map((slice) => (
          <View
            key={slice.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: slice.color,
              }}
            />
            <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text variant="smallMedium">
              {total > 0 ? `${Math.round((slice.value / total) * 100)}%` : '0%'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
