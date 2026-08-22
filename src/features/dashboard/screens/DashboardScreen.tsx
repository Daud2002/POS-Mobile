import {
  AlertTriangle,
  Package,
  Receipt,
  ShoppingCart,
  Wallet,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { AreaChart } from '@/components/charts/AreaChart';
import { SectionCard } from '@/components/data/SectionCard';
import { StatCard } from '@/components/data/StatCard';
import { StatusPill } from '@/components/data/StatusPill';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { Gradient } from '@/components/ui/Gradient';
import { Text } from '@/components/ui/Text';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { displayDate } from '@/lib/date';
import { orderNumberLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { useDashboardData } from '../hooks/useDashboardData';

/**
 * Store owner's home screen.
 *
 * Layout: greeting row → gradient hero with today's revenue (the number the
 * owner opens the app for) → a toned stat row → weekly trend → best sellers
 * with share bars → recent orders.
 */
export function DashboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { format } = useStoreCurrency();
  const data = useDashboardData();

  const maxTopQuantity = Math.max(...data.topProducts.map((p) => p.quantity), 1);

  return (
    <Screen
      scrollable
      edges={['top', 'bottom']}
      onRefresh={data.refetch}
      refreshing={data.refetching}
    >
      {/* Greeting: date, name, gradient-ring avatar ---------------------- */}
      <View style={[styles.greetingRow, { gap: theme.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="overline" color="mutedForeground">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <Text
            variant="displayLarge"
            numberOfLines={1}
            style={{ marginTop: theme.spacing.xxs }}
          >
            Hi, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </Text>
        </View>

        {/* Story-style gradient ring around the avatar. */}
        <Gradient variant="primary" style={styles.avatarRing}>
          <View
            style={[styles.avatarGap, { backgroundColor: theme.colors.background }]}
          >
            <Avatar name={user?.name} size={40} />
          </View>
        </Gradient>
      </View>

      {/* Hero: today's revenue ------------------------------------------ */}
      <View style={[{ borderRadius: theme.radius.xl }, theme.shadows.glow]}>
        <Gradient
          variant="primary"
          style={{
            borderRadius: theme.radius.xl,
            padding: theme.spacing['2xl'],
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles, echoing the web login hero's gradient blobs. */}
          <View style={[styles.blob, styles.blobLarge]} />
          <View style={[styles.blob, styles.blobSmall]} />

          <View style={[styles.heroLabelRow, { gap: theme.spacing.sm }]}>
            <Wallet size={16} color="#FFFFFFCC" />
            <Text variant="smallMedium" style={{ color: '#FFFFFFCC' }}>
              Today's Revenue
            </Text>
          </View>

          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: theme.fontFamily.headingBold,
              fontSize: 38,
              lineHeight: 46,
              marginTop: theme.spacing.sm,
            }}
            numberOfLines={1}
          >
            {data.loading ? '—' : format(data.todayRevenue)}
          </Text>

          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#FFFFFF26',
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 5,
              marginTop: theme.spacing.md,
            }}
          >
            <Text variant="caption" style={{ color: '#FFFFFF' }}>
              {data.todayOrderCount} order{data.todayOrderCount === 1 ? '' : 's'} today
            </Text>
          </View>
        </Gradient>
      </View>

      {/* Stat row -------------------------------------------------------- */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatCard
          title="Total Orders"
          value={String(data.totalOrders)}
          tone="info"
          icon={<ShoppingCart size={19} color={theme.colors.info} />}
          loading={data.loading}
        />
        <StatCard
          title="Products"
          value={String(data.productCount)}
          tone="accent"
          icon={<Package size={19} color={theme.colors.accent} />}
          loading={data.loading}
        />
        <StatCard
          title="Low Stock"
          value={String(data.lowStockCount)}
          tone="warning"
          icon={<AlertTriangle size={19} color={theme.colors.warning} />}
          loading={data.loading}
        />
      </View>

      {/* Weekly trend ----------------------------------------------------- */}
      <SectionCard title="Weekly Sales" subtitle="Revenue over the last 7 days">
        <AreaChart data={data.weeklySales} formatValue={format} />
      </SectionCard>

      {/* Best sellers ------------------------------------------------------ */}
      <SectionCard title="Top Products" subtitle="Best sellers by units sold">
        {data.topProducts.length === 0 ? (
          <Text variant="small" color="mutedForeground">
            No sales recorded yet.
          </Text>
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {data.topProducts.map((product, index) => (
              <View key={product.name} style={{ gap: theme.spacing.xs }}>
                <View style={[styles.topRow, { gap: theme.spacing.md }]}>
                  <View
                    style={[
                      styles.rank,
                      {
                        borderRadius: theme.radius.sm,
                        backgroundColor:
                          index === 0
                            ? theme.tint(theme.colors.primary, 0.14)
                            : theme.colors.muted,
                      },
                    ]}
                  >
                    <Text
                      variant="smallMedium"
                      style={{
                        color:
                          index === 0
                            ? theme.colors.primary
                            : theme.colors.mutedForeground,
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <Text variant="smallMedium" style={{ flex: 1 }} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text variant="smallMedium" color="mutedForeground">
                    {product.quantity} sold
                  </Text>
                </View>

                {/* Share bar: quantity relative to the best seller. */}
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.colors.muted,
                    marginLeft: 28 + theme.spacing.md,
                    overflow: 'hidden',
                  }}
                >
                  <Gradient
                    variant="primary"
                    style={{
                      height: '100%',
                      width: `${Math.max(6, (product.quantity / maxTopQuantity) * 100)}%`,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Recent orders ------------------------------------------------------ */}
      <SectionCard title="Recent Orders">
        {data.recentOrders.length === 0 ? (
          <Text variant="small" color="mutedForeground">
            No orders yet.
          </Text>
        ) : (
          data.recentOrders.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? <Divider spacing="sm" /> : null}
              <View style={[styles.orderRow, { gap: theme.spacing.md }]}>
                <View
                  style={[
                    styles.orderIcon,
                    {
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.tint(theme.colors.info, 0.1),
                    },
                  ]}
                >
                  <Receipt size={17} color={theme.colors.info} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text variant="smallMedium">
                    #{orderNumberLabel(order.orderNumber)}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {displayDate(order.createdAt)}
                  </Text>
                </View>

                <StatusPill status={order.status} />
                <Text variant="money">{format(order.total)}</Text>
              </View>
            </View>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center' },
  blob: {
    position: 'absolute',
    backgroundColor: '#FFFFFF14',
    borderRadius: 999,
  },
  blobLarge: { width: 190, height: 190, top: -70, right: -50 },
  blobSmall: { width: 110, height: 110, bottom: -50, right: 60 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  rank: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  orderIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
