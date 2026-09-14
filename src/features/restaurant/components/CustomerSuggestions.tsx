import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, UserCircle } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { customersApi } from '@/api/services';
import type { CustomerSuggestion } from '@/api/types';
import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { useDebouncedValue } from '@/hooks/useDebouncedCallback';
import { useTheme } from '@/theme';

/** Fewer characters than this and the server returns nothing anyway. */
const MIN_QUERY = 2;

interface CustomerSuggestionsProps {
  /** What is in the field the cashier is typing into right now. */
  query: string;
  /** False when no customer field has focus; nothing is fetched or shown. */
  visible: boolean;
  onSelect: (customer: CustomerSuggestion) => void;
}

/**
 * Live matches from the store's customer directory, shown ABOVE the customer
 * fields on the order sheet as the cashier types.
 *
 * Rendered in-flow rather than floated: a sheet scrolls, and an absolutely
 * positioned overlay inside one is clipped or lands behind the keyboard. A
 * short in-flow list pushes the fields down and stays fully tappable.
 */
export function CustomerSuggestions({ query, visible, onSelect }: CustomerSuggestionsProps) {
  const theme = useTheme();
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = visible && debounced.length >= MIN_QUERY;

  const suggestions = useQuery({
    queryKey: queryKeys.customerSuggest(debounced),
    queryFn: () => customersApi.suggest(debounced),
    enabled,
    staleTime: 30_000,
  });

  const rows = enabled ? (suggestions.data ?? []) : [];
  if (!enabled || (rows.length === 0 && !suggestions.isFetching)) return null;

  return (
    <View
      style={[
        styles.panel,
        { borderRadius: theme.radius.md, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
      ]}
    >
      {rows.length === 0 ? (
        <Text variant="caption" color="mutedForeground" style={{ padding: theme.spacing.sm }}>
          Searching…
        </Text>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="always" nestedScrollEnabled>
          {rows.map((customer, index) => (
            <View key={customer.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => onSelect(customer)}
                style={({ pressed }) => [
                  styles.row,
                  { padding: theme.spacing.sm, backgroundColor: pressed ? theme.colors.muted : 'transparent' },
                ]}
              >
                <View style={styles.line}>
                  <UserCircle size={14} color={theme.colors.mutedForeground} />
                  <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>
                    {customer.name}
                  </Text>
                  <Phone size={12} color={theme.colors.mutedForeground} />
                  <Text variant="caption" color="mutedForeground">
                    {customer.phone}
                  </Text>
                </View>
                {customer.address ? (
                  <View style={styles.line}>
                    <MapPin size={12} color={theme.colors.mutedForeground} />
                    <Text variant="caption" color="mutedForeground" numberOfLines={1} style={{ flex: 1 }}>
                      {customer.address}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, overflow: 'hidden' },
  list: { maxHeight: 180 },
  row: { gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
