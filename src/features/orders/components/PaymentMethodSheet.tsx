import { useState } from 'react';
import { View } from 'react-native';

import { PaymentMethod } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

import { PaymentSelector } from '@/features/pos/components/PaymentSelector';

interface PaymentMethodSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => void;
  loading?: boolean;
}

/**
 * Asks which payment method settled an unpaid order.
 *
 * The web app is inconsistent here: CustomerOrdersPage opens a modal and sends
 * the chosen method, while OrdersPage marks orders paid with no method at all.
 * Mobile always asks, so `paymentMethod` is never left blank on a paid order.
 */
export function PaymentMethodSheet({
  open,
  onClose,
  onConfirm,
  loading = false,
}: PaymentMethodSheetProps) {
  const theme = useTheme();
  const [method, setMethod] = useState<PaymentMethod | null>('cash');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mark as Paid"
      description="How was this order settled?"
      footer={
        <>
          <Button
            label="Cancel"
            variant="outline"
            onPress={onClose}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            label="Mark as Paid"
            onPress={() => method && onConfirm(method)}
            disabled={!method || loading}
            loading={loading}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <View style={{ paddingVertical: theme.spacing.sm }}>
        <PaymentSelector
          value={method}
          isUnpaid={false}
          allowUnpaid={false}
          onSelect={setMethod}
          onSelectUnpaid={() => setMethod(null)}
        />
      </View>
    </Sheet>
  );
}
