import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export type StatTone = 'primary' | 'accent' | 'info' | 'warning' | 'destructive';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  /** Icon chip color. Varying tones across a stat row keeps it scannable. */
  tone?: StatTone;
  trend?: { value: string; positive: boolean };
  loading?: boolean;
}

/**
 * Dashboard KPI card. The icon chip takes a per-stat tone (info blue for
 * orders, violet for products, amber for low stock…) so a row of four stats
 * doesn't read as one undifferentiated block of green.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'primary',
  trend,
  loading = false,
}: StatCardProps) {
  const theme = useTheme();
  const toneColor = theme.colors[tone];

  return (
    <Card padding="lg" style={styles.card}>
      <View style={[styles.header, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.iconChip,
            {
              borderRadius: theme.radius.md,
              backgroundColor: theme.tint(toneColor, 0.12),
            },
          ]}
        >
          {icon}
        </View>

        {trend ? (
          <View
            style={{
              backgroundColor: theme.tint(
                trend.positive ? theme.colors.success : theme.colors.destructive,
                0.1,
              ),
              borderRadius: theme.radius.full,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              variant="caption"
              style={{
                color: trend.positive ? theme.colors.success : theme.colors.destructive,
              }}
            >
              {trend.positive ? '↑' : '↓'} {trend.value}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <Skeleton width="70%" height={26} style={{ marginTop: theme.spacing.md }} />
      ) : (
        <Text variant="display" style={{ marginTop: theme.spacing.md }} numberOfLines={1}>
          {value}
        </Text>
      )}

      <Text
        variant="caption"
        color="mutedForeground"
        style={{ marginTop: theme.spacing.xxs }}
      >
        {title}
        {subtitle ? ` · ${subtitle}` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 150 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconChip: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
