import { Plus, X } from 'lucide-react-native';
import { View } from 'react-native';

import { InventoryUnit } from '@/api/types';
import { Button, IconButton, Input, Text } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useTheme } from '@/theme/ThemeProvider';

import { unitSuffix } from '../lib/quantity';
import { newRecipeRow, RecipeRow } from '../lib/recipe';

/** What the picker needs to know about an ingredient. */
export interface RecipeOption {
  id: string;
  name: string;
  unit: InventoryUnit;
  isActive: boolean;
}

interface RecipeEditorProps {
  rows: RecipeRow[];
  onChange: (rows: RecipeRow[]) => void;
  options: RecipeOption[];
  loading?: boolean;
  error?: string;
}

/**
 * The Ingredients section of a restaurant product: how much of each item ONE
 * unit of the product uses. The server deducts it when an order is paid.
 */
export function RecipeEditor({ rows, onChange, options, loading, error }: RecipeEditorProps) {
  const theme = useTheme();
  const byId = new Map(options.map((option) => [option.id, option]));

  const patch = (key: string, change: Partial<RecipeRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="smallMedium">Ingredients</Text>

      {loading ? (
        <Text variant="small" color="mutedForeground">
          Loading recipe…
        </Text>
      ) : (
        rows.map((row) => {
          const chosen = byId.get(row.inventoryItemId);
          // Offer every active item not already used on another row, plus
          // this row's own pick even if it has since been retired.
          const taken = new Set(
            rows.filter((other) => other.key !== row.key).map((other) => other.inventoryItemId),
          );
          const rowOptions = options
            .filter(
              (option) =>
                option.id === row.inventoryItemId || (option.isActive && !taken.has(option.id)),
            )
            .map((option) => ({
              value: option.id,
              label: `${option.name} (${unitSuffix(option.unit)})${option.isActive ? '' : ' · retired'}`,
            }));

          return (
            <View
              key={row.key}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
            >
              <View style={{ flex: 1.4 }}>
                <Select
                  value={row.inventoryItemId}
                  onChange={(value) => patch(row.key, { inventoryItemId: value })}
                  options={rowOptions}
                  placeholder="Choose item"
                />
              </View>
              <Input
                containerStyle={{ flex: 1 }}
                value={row.quantity}
                onChangeText={(quantity) => patch(row.key, { quantity })}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel="Amount used per item"
                trailing={
                  chosen ? (
                    <Text variant="caption" color="mutedForeground">
                      {chosen.unit === 'bottle' ? 'btl' : chosen.unit}
                    </Text>
                  ) : undefined
                }
              />
              <IconButton
                accessibilityLabel="Remove ingredient"
                onPress={() => onChange(rows.filter((other) => other.key !== row.key))}
                size={44}
              >
                <X size={16} color={theme.colors.mutedForeground} />
              </IconButton>
            </View>
          );
        })
      )}

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : null}

      {!loading ? (
        options.length === 0 && rows.length === 0 ? (
          <Text variant="caption" color="mutedForeground">
            No inventory items yet.
          </Text>
        ) : (
          <Button
            label="Add ingredient"
            variant="outline"
            size="sm"
            icon={<Plus size={14} color={theme.colors.foreground} />}
            onPress={() => onChange([...rows, newRecipeRow()])}
          />
        )
      ) : null}
    </View>
  );
}
