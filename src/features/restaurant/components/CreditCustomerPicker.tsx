import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Search, UserCircle, UserPlus, X } from 'lucide-react-native';

import { Input, SearchInput, Text } from '@/components/ui';
import { creditCustomerOf } from '@/lib/creditSales';
import { tint, useTheme } from '@/theme';
import type { CreditCustomerChoice, RestaurantOrder } from '@/api/types';
import { CustomerSuggestions } from './CustomerSuggestions';

interface CreditCustomerPickerProps {
  /** The order going on credit — its customer, if it has one, is pre-picked. */
  order: RestaurantOrder;
  /** The choice as the server takes it, or null while it cannot be sent yet. */
  onChange: (choice: CreditCustomerChoice | null) => void;
}

/**
 * Who owes it — the body of the till's "Add to credit sales" step. Mirrors
 * the web till's CreditCustomerDialog: find a customer in the directory
 * through /customers/suggest (the only customer search a cashier may use —
 * the full customer list 403s for them), or type a new one's name and phone,
 * which the server files when the order goes on credit.
 *
 * Rendered INSIDE the checkout sheet rather than as a sheet of its own: both
 * are RN Modals, and presenting a second one over the first is unreliable on
 * iOS.
 */
export function CreditCustomerPicker({ order, onChange }: CreditCustomerPickerProps) {
  const theme = useTheme();
  // Start from what the order already knows: a delivery's customer is picked;
  // a typed name and phone open on "New customer" with both filled in.
  const [mode, setMode] = useState<'find' | 'new'>(
    order.customerId ? 'find' : order.customerPhone ? 'new' : 'find',
  );
  const [picked, setPicked] = useState<{ id: string; name: string; phone: string | null } | null>(
    order.customerId
      ? { id: order.customerId, name: order.customerName || 'Customer', phone: order.customerPhone ?? null }
      : null,
  );
  const [query, setQuery] = useState('');
  const [name, setName] = useState(order.customerId ? '' : (order.customerName ?? ''));
  const [phone, setPhone] = useState(order.customerId ? '' : (order.customerPhone ?? ''));

  const choice = creditCustomerOf({ mode, picked, name, phone });
  const choiceKey = JSON.stringify(choice);
  useEffect(() => {
    onChange(choice);
    // Keyed on the serialised choice: the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceKey]);

  const tab = (value: 'find' | 'new', label: string, Icon: typeof Search) => {
    const active = mode === value;
    return (
      <Pressable
        key={value}
        onPress={() => setMode(value)}
        style={[
          styles.tab,
          { borderRadius: theme.radius.md, backgroundColor: active ? theme.colors.card : 'transparent' },
        ]}
      >
        <Icon size={14} color={active ? theme.colors.foreground : theme.colors.mutedForeground} />
        <Text variant={active ? 'smallMedium' : 'small'} color={active ? 'foreground' : 'mutedForeground'}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={[styles.tabs, { backgroundColor: theme.colors.muted, borderRadius: theme.radius.md }]}>
        {tab('find', 'Find customer', Search)}
        {tab('new', 'New customer', UserPlus)}
      </View>

      {mode === 'find' ? (
        picked ? (
          <View
            style={[
              styles.picked,
              {
                borderRadius: theme.radius.md,
                borderColor: theme.colors.primary,
                backgroundColor: tint(theme.colors.primary, 0.06),
                padding: theme.spacing.md,
              },
            ]}
          >
            <UserCircle size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {picked.name}
              </Text>
              {picked.phone ? (
                <Text variant="caption" color="mutedForeground">
                  {picked.phone}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setPicked(null)} hitSlop={10} accessibilityLabel="Choose someone else">
              <X size={18} color={theme.colors.mutedForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <SearchInput value={query} onChangeText={setQuery} placeholder="Search by name or phone" />
            <CustomerSuggestions
              query={query}
              visible
              onSelect={(c) => setPicked({ id: c.id, name: c.name, phone: c.phone })}
            />
            <Text variant="caption" color="mutedForeground">
              Not in the list? Use New customer to add them.
            </Text>
          </View>
        )
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Input label="Name" placeholder="Customer name" value={name} onChangeText={setName} />
          <Input
            label="Phone"
            placeholder="03xx xxxxxxx"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            hint="Required — it is how the customer is found next time. An existing customer with this number is used instead of a new one."
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, padding: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
});
