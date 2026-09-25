import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { InventoryItem, StockInPayload } from '@/api/types';
import { Button, FilterPillRow, Input, Sheet, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { formatQuantity, parseAmount, stockInTotal, unitSuffix } from '../lib/quantity';

type BottleMode = 'sets' | 'bottles';

interface StockInSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
  saving: boolean;
  onSubmit: (id: string, payload: StockInPayload) => Promise<unknown>;
}

/**
 * Record a delivery. Bottles default to SETS, since that is how they arrive:
 * the server multiplies by the item's pack size, and the total is previewed
 * here so "4" never silently means four bottles when it meant four crates.
 */
export function StockInSheet({ item, onClose, saving, onSubmit }: StockInSheetProps) {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<BottleMode>('sets');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!item) return;
    setAmount('');
    setMode('sets');
    setNote('');
    setError(undefined);
  }, [item]);

  if (!item) return null;

  const isBottle = item.unit === 'bottle';
  const inPacks = isBottle && mode === 'sets';
  const value = parseAmount(amount);
  const total = value !== null && value > 0 ? stockInTotal(item, value, inPacks) : null;

  const submit = async () => {
    if (value === null || value <= 0) {
      setError('Enter how much arrived');
      return;
    }
    await onSubmit(item.id, {
      amount: value,
      inPacks: isBottle ? inPacks : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={`Stock in · ${item.name}`}
      description={`On hand: ${formatQuantity(item.quantity, item.unit)}`}
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
            label={saving ? 'Saving…' : 'Add stock'}
            onPress={() => void submit().catch(() => undefined)}
            loading={saving}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {isBottle ? (
        <FilterPillRow<BottleMode>
          scrollable={false}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'sets', label: `Sets of ${item.packSize}` },
            { value: 'bottles', label: 'Bottles' },
          ]}
        />
      ) : null}

      <Input
        label="Amount received"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setError(undefined);
        }}
        placeholder="0"
        keyboardType="decimal-pad"
        autoFocus
        trailing={
          <Text variant="small" color="mutedForeground">
            {inPacks ? 'sets' : unitSuffix(item.unit)}
          </Text>
        }
        error={error}
      />

      {total !== null ? (
        <View style={{ gap: theme.spacing.xs }}>
          {inPacks ? (
            <Text variant="small" color="mutedForeground">
              = {formatQuantity(total, item.unit)}
            </Text>
          ) : null}
          <Text variant="smallMedium">
            New total: {formatQuantity(item.quantity + total, item.unit)}
          </Text>
        </View>
      ) : null}

      <Input
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Optional, e.g. supplier or invoice"
        maxLength={500}
      />
    </Sheet>
  );
}
