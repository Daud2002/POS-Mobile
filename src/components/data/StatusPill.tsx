import { OrderStatus } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { statusTone } from '@/constants/statuses';

interface StatusPillProps {
  status: OrderStatus | string | undefined;
}

/**
 * Order status badge, colored from the single canonical map in
 * constants/statuses.ts. The web app has four conflicting maps, one of which
 * never matches the statuses the POS actually writes.
 */
export function StatusPill({ status }: StatusPillProps) {
  return <Badge label={status ?? 'unknown'} tone={statusTone(status)} dot />;
}
