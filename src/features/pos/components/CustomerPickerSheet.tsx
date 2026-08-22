import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { customersApi } from '@/api/services';
import { Customer } from '@/api/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface CustomerPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

/**
 * Customer picker for the POS.
 *
 * NOTE: GET /customers is not store-scoped on the backend — the
 * CustomersController has no store filtering, so every store sees every
 * customer. Until that is fixed server-side the list is what the API returns.
 */
export function CustomerPickerSheet({ open, onClose, onSelect }: CustomerPickerSheetProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.customers(),
    queryFn: () => customersApi.list(0, 1000),
    enabled: open,
  });

  const customers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data ?? [];
    if (!term) return all;

    return all.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.phone?.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Select Customer"
      description="Attaching a customer marks the sale unpaid"
      scrollable={false}
      maxHeightRatio={0.85}
    >
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone or email"
        />

        {isLoading ? (
          <View style={{ gap: theme.spacing.md }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} height={56} />
            ))}
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(customer) => customer.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
            ListEmptyComponent={
              <EmptyState
                title="No customers found"
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Add customers from the Customers screen.'
                }
                icon={<UserPlus size={28} color={theme.colors.mutedForeground} />}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => ({
                  padding: theme.spacing.lg,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
                })}
              >
                <Text variant="bodyMedium">{item.name}</Text>
                <Text variant="caption" color="mutedForeground">
                  {[item.phone, item.city].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Sheet>
  );
}
