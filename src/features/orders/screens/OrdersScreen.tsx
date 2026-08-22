import { ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Order, PaymentMethod } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPillRow } from '@/components/ui/FilterPill';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ORDER_STATUS_FILTERS } from '@/constants/statuses';
import { useTheme } from '@/theme/ThemeProvider';

import { OrderCard } from '../components/OrderCard';
import { PaymentMethodSheet } from '../components/PaymentMethodSheet';
import { useOrders } from '../hooks/useOrders';
import { useReprint } from '../hooks/useReprint';

/**
 * Order history.
 *
 * One screen serves both roles — the web app has two near-identical pages
 * (CashierOrdersPage and OrdersPage) that drifted apart, with different status
 * maps and different Mark Paid behaviour. Only the store owner sees Mark Paid.
 */
export function OrdersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { orders, filter, setFilter, loading, refetching, refetch, error, markPaid, markingPaid } =
    useOrders();
  const { reprint, reprintingId } = useReprint();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const canMarkPaid = user?.role === 'store_owner';

  const handleConfirmPaid = async (method: PaymentMethod) => {
    if (!payingOrder) return;
    await markPaid({ orderId: payingOrder.id, method });
    setPayingOrder(null);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <SectionHeader title="Orders" subtitle={`${orders.length} orders`} />
        <FilterPillRow options={ORDER_STATUS_FILTERS} value={filter} onChange={setFilter} />
      </View>

      {loading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={5} lines={2} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(order) => order.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={error ? 'Could not load orders' : 'No orders yet'}
              description={
                error
                  ? 'Pull down to try again.'
                  : filter === 'all'
                    ? 'Completed sales will appear here.'
                    : `No ${filter} orders.`
              }
              icon={<ShoppingBag size={28} color={theme.colors.mutedForeground} />}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              onReprint={reprint}
              reprinting={reprintingId === item.id}
              onMarkPaid={canMarkPaid ? setPayingOrder : undefined}
              markingPaid={markingPaid && payingOrder?.id === item.id}
            />
          )}
        />
      )}

      <PaymentMethodSheet
        open={!!payingOrder}
        onClose={() => setPayingOrder(null)}
        onConfirm={handleConfirmPaid}
        loading={markingPaid}
      />
      </PageFade>
    </SafeAreaView>
  );
}
