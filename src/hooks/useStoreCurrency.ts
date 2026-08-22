import { useCallback, useMemo } from 'react';

import { Decimal } from '@/api/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { formatCurrency } from '@/lib/currencies';
import { toNumber } from '@/lib/format';

/**
 * Money formatting bound to the store's currency (from /auth/me).
 *
 * `format` accepts a Decimal so callers don't have to remember that /orders
 * returns money as strings.
 */
export function useStoreCurrency() {
  const { user } = useAuth();
  const currency = user?.currency || 'PKR';

  const format = useCallback(
    (amount: Decimal | null | undefined) => formatCurrency(toNumber(amount), currency),
    [currency],
  );

  return useMemo(() => ({ currency, format }), [currency, format]);
}
