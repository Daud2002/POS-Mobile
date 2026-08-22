import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Pencil, Trash2, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { customersApi } from '@/api/services';
import { Customer, CustomerPayload } from '@/api/types';
import { RootStackParamList } from '@/app/navigation/types';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Fab } from '@/components/ui/Fab';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { useTheme } from '@/theme/ThemeProvider';

import { CustomerFormSheet } from '../components/CustomerFormSheet';

/**
 * Customer directory.
 *
 * NOTE: GET /customers is not store-scoped on the backend — the controller has
 * no store filtering — so this list spans every store on the platform. Worth
 * fixing server-side; there is nothing the client can do about it safely.
 */
export function CustomersScreen() {
  const theme = useTheme();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { format } = useStoreCurrency();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const query = useQuery({
    queryKey: queryKeys.customers(),
    queryFn: () => customersApi.list(0, 1000),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customers() });

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const save = useMutation({
    mutationFn: (payload: CustomerPayload) =>
      editing ? customersApi.update(editing.id, payload) : customersApi.create(payload),
    onSuccess: () => {
      toast.success(editing ? 'Customer updated' : 'Customer created');
      invalidate();
      setFormOpen(false);
    },
    onError: (error) => fail(error, 'Could not save the customer.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      toast.success('Customer deleted');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not delete the customer.'),
  });

  const customers = useMemo(() => {
    const all = query.data ?? [];
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return all;

    return all.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.phone?.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.city?.toLowerCase().includes(term),
    );
  }, [query.data, debouncedSearch]);

  return (
    <SafeAreaView
      edges={['bottom']}
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
        <SectionHeader
          title="Customers"
          subtitle={`${query.data?.length ?? 0} total`}
        />
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone, email or city"
        />
      </View>

      {query.isLoading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={6} lines={1} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(customer) => customer.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No matching customers' : 'No customers yet'}
              description={
                search
                  ? 'Try a different search term.'
                  : 'Add customers to track credit sales and purchase history.'
              }
              icon={<UserPlus size={28} color={theme.colors.mutedForeground} />}
              actionLabel={search ? undefined : 'Add Customer'}
              onAction={
                search
                  ? undefined
                  : () => {
                      setEditing(null);
                      setFormOpen(true);
                    }
              }
            />
          }
          renderItem={({ item }) => (
            <Card padding="none">
              <Pressable
                onPress={() =>
                  navigation.navigate('CustomerOrders', {
                    customerId: item.id,
                    customerName: item.name,
                  })
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.lg,
                  backgroundColor: pressed ? theme.colors.muted : 'transparent',
                  borderRadius: theme.radius.lg,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {[item.phone, item.city, item.email].filter(Boolean).join(' · ')}
                  </Text>
                  <Text
                    variant="smallMedium"
                    style={{ marginTop: theme.spacing.xxs }}
                  >
                    {format(item.totalSpent)} spent
                  </Text>
                </View>

                <ChevronRight size={18} color={theme.colors.mutedForeground} />
              </Pressable>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: theme.spacing.lg,
                }}
              >
                <IconButton
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => {
                    setEditing(item);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={16} color={theme.colors.foreground} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`Delete ${item.name}`}
                  tone="destructive"
                  onPress={() => setDeleting(item)}
                >
                  <Trash2 size={16} color={theme.colors.destructive} />
                </IconButton>
              </View>
            </Card>
          )}
        />
      )}

      <Fab
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        accessibilityLabel="Add customer"
      />

      <CustomerFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
        saving={save.isPending}
        onSubmit={save.mutateAsync}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete Customer"
        description={`"${deleting?.name}" and their link to past orders will be removed.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />
      </PageFade>
    </SafeAreaView>
  );
}
