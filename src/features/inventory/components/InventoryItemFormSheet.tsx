import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  InventoryItem,
  InventoryItemPayload,
  InventoryItemUpdatePayload,
  InventoryUnit,
} from '@/api/types';
import { Button, Input, Sheet, Switch, Text } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { useTheme } from '@/theme/ThemeProvider';

import { DEFAULT_PACK_SIZE, INVENTORY_UNITS, parseAmount, unitSuffix } from '../lib/quantity';

interface InventoryItemFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Null means "create". */
  item: InventoryItem | null;
  saving: boolean;
  onCreate: (payload: InventoryItemPayload) => Promise<unknown>;
  onUpdate: (id: string, payload: InventoryItemUpdatePayload) => Promise<unknown>;
}

interface FormErrors {
  name?: string;
  packSize?: string;
  quantity?: string;
  lowStockThreshold?: string;
}

/**
 * Add or edit an ingredient.
 *
 * Unit and count are fixed once the item exists: recipes are written in the
 * unit, and the count only moves through stock-in, adjust and sales so every
 * change leaves a movement behind. Editing therefore shows the unit read-only
 * and offers no quantity field at all.
 */
export function InventoryItemFormSheet({
  open,
  onClose,
  item,
  saving,
  onCreate,
  onUpdate,
}: InventoryItemFormSheetProps) {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('ml');
  const [packSize, setPackSize] = useState(String(DEFAULT_PACK_SIZE));
  const [opening, setOpening] = useState('');
  const [threshold, setThreshold] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  // Repopulate whenever the sheet opens, so editing one item then another
  // never shows stale values.
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setUnit(item?.unit ?? 'ml');
    setPackSize(String(item?.packSize ?? DEFAULT_PACK_SIZE));
    setOpening('');
    setThreshold(item?.lowStockThreshold == null ? '' : String(item.lowStockThreshold));
    setIsActive(item?.isActive ?? true);
    setErrors({});
  }, [open, item]);

  const isBottle = unit === 'bottle';

  const submit = async () => {
    const next: FormErrors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Name is required';

    const pack = Number(packSize);
    if (isBottle && (!Number.isInteger(pack) || pack < 1 || pack > 1000)) {
      next.packSize = 'Enter a whole number from 1 to 1000';
    }

    const openingValue = parseAmount(opening);
    if (!item && opening.trim() && (openingValue === null || openingValue < 0)) {
      next.quantity = 'Enter a valid amount';
    }

    // Blank means "never flag it", which is different from flagging at 0.
    const thresholdValue = parseAmount(threshold);
    if (threshold.trim() && (thresholdValue === null || thresholdValue < 0)) {
      next.lowStockThreshold = 'Enter a valid amount, or leave blank';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (item) {
      await onUpdate(item.id, {
        name: trimmed,
        packSize: isBottle ? pack : undefined,
        lowStockThreshold: thresholdValue,
        isActive,
      });
    } else {
      await onCreate({
        name: trimmed,
        unit,
        packSize: isBottle ? pack : undefined,
        quantity: openingValue ?? undefined,
        lowStockThreshold: thresholdValue,
      });
    }
    onClose();
  };

  const suffix = (
    <Text variant="small" color="mutedForeground">
      {unitSuffix(unit)}
    </Text>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Edit Item' : 'New Item'}
      footer={
        <>
          <Button
            label="Cancel"
            variant="outline"
            onPress={onClose}
            disabled={saving}
            style={{ flex: 1 }}
          />
          <Button
            label={saving ? 'Saving…' : item ? 'Update' : 'Create'}
            onPress={() => void submit().catch(() => undefined)}
            loading={saving}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Milk"
        error={errors.name}
      />

      {item ? (
        <Input
          label="Unit"
          value={INVENTORY_UNITS.find((option) => option.value === item.unit)?.label ?? item.unit}
          editable={false}
          hint="Fixed once created — recipes are written in this unit."
        />
      ) : (
        <Select
          label="Unit"
          value={unit}
          onChange={(value) => setUnit(value as InventoryUnit)}
          options={INVENTORY_UNITS.map((option) => ({ ...option }))}
        />
      )}

      {isBottle ? (
        <Input
          label="Bottles per set"
          value={packSize}
          onChangeText={setPackSize}
          placeholder={String(DEFAULT_PACK_SIZE)}
          keyboardType="number-pad"
          hint="Lets you record deliveries in sets, e.g. 4 sets = 24 bottles."
          error={errors.packSize}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {item ? null : (
          <Input
            containerStyle={{ flex: 1 }}
            label="Opening stock"
            value={opening}
            onChangeText={setOpening}
            placeholder="0"
            keyboardType="decimal-pad"
            trailing={suffix}
            error={errors.quantity}
          />
        )}
        <Input
          containerStyle={{ flex: 1 }}
          label="Low stock at"
          value={threshold}
          onChangeText={setThreshold}
          placeholder="Never"
          keyboardType="decimal-pad"
          trailing={suffix}
          error={errors.lowStockThreshold}
        />
      </View>

      {item ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium">Active</Text>
            <Text variant="caption" color="mutedForeground">
              Retired items leave the recipe picker but keep their history.
            </Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      ) : null}
    </Sheet>
  );
}
