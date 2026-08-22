import { useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Circle,
} from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface AreaPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: AreaPoint[];
  height?: number;
  /** Formats the max-value label, e.g. currency. */
  formatValue?: (value: number) => string;
}

const PADDING_TOP = 12;
const PADDING_BOTTOM = 24;

/**
 * Area chart with a gradient fill — the mobile equivalent of the web
 * dashboard's recharts AreaChart.
 *
 * Drawn directly with react-native-svg rather than pulling in a charting
 * library: three chart types are needed in total, and hand-drawing them keeps
 * the palette and typography identical to the rest of the app.
 */
export function AreaChart({ data, height = 180, formatValue }: AreaChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const max = Math.max(...data.map((point) => point.value), 1);

  const pointAt = (index: number, value: number) => ({
    x: data.length === 1 ? width / 2 : (index / (data.length - 1)) * width,
    y: PADDING_TOP + chartHeight - (value / max) * chartHeight,
  });

  const coordinates = data.map((point, index) => pointAt(index, point.value));

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');

  const areaPath =
    coordinates.length > 0
      ? `${linePath} L${coordinates[coordinates.length - 1].x},${PADDING_TOP + chartHeight} L${coordinates[0].x},${PADDING_TOP + chartHeight} Z`
      : '';

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          <Path d={areaPath} fill="url(#areaFill)" />
          <Path
            d={linePath}
            stroke={theme.colors.primary}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {coordinates.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3}
              fill={theme.colors.card}
              stroke={theme.colors.primary}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.map((point) => (
          <Text key={point.label} variant="caption" color="mutedForeground">
            {point.label}
          </Text>
        ))}
      </View>

      {formatValue ? (
        <Text
          variant="caption"
          color="mutedForeground"
          style={{ marginTop: theme.spacing.sm }}
        >
          Peak {formatValue(max)}
        </Text>
      ) : null}
    </View>
  );
}
