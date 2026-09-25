import { useEffect, useState } from 'react';

import { AdjustStockPayload, InventoryItem } from '@/api/types';
import { Button, Input, Sheet, Text } from '@/components/ui';

import { formatAmount, formatQuantity, parseAmount, unitSuffix } from '../lib/quantity';

interface AdjustStockSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
  saving: boolean;
  onSubmit: (id: string, payload: AdjustStockPayload) => Promise<unknown>;
}

/**
 * Set the count to what is physically on the shelf. The server records the
 * difference as an adjustment, so the note is where "spilled a carton" goes.
 */
export function AdjustStockSheet({ item, onClose, saving, onSubmit }: AdjustStockSheetProps) {
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!item) return;
    // Prefilled with the record, unless it has gone negative — nobody counts
    // a negative shelf, so start them from blank instead.
    setCounted(item.quantity < 0 ? '' : formatAmount(item.quantity));
    setNote('');
    setError(undefined);
  }, [item]);

  if (!item) return null;

  const value = parseAmount(counted);
  const diff = value === null ? null : Math.round((value - item.quantity) * 1000) / 1000;

  const submit = async () => {
    if (value === null) {
      setError('Enter the quantity you counted');
      return;
    }
    await onSubmit(item.id, { quantity: value, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={`Adjust · ${item.name}`}
      description={`Recorded: ${formatQuantity(item.quantity, item.unit)}`}
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
            label={saving ? 'Saving…' : 'Save count'}
            onPress={() => void submit().catch(() => undefined)}
            loading={saving}
            disabled={saving || diff === 0}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input
        label="Counted on hand"
        value={counted}
        onChangeText={(text) => {
          setCounted(text);
          setError(undefined);
        }}
        placeholder="0"
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        trailing={
          <Text variant="small" color="mutedForeground">
            {unitSuffix(item.unit)}
          </Text>
        }
        error={error}
      />

      {diff !== null && diff !== 0 ? (
        <Text variant="smallMedium" color={diff > 0 ? 'success' : 'destructive'}>
          {diff > 0 ? '+' : ''}
          {formatQuantity(diff, item.unit)} against the record
        </Text>
      ) : null}

      <Input
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Optional, e.g. spilled a carton"
        maxLength={500}
      />
    </Sheet>
  );
}
