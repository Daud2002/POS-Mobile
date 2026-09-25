import { useInfiniteQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { queryKeys } from '@/api/queryKeys';
import { inventoryApi } from '@/api/services';
import { InventoryItem, InventoryMovementType } from '@/api/types';
import { Badge, BadgeTone, Button, Sheet, SkeletonList, Text } from '@/components/ui';
import { displayDate, timeLabel } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';

import { formatQuantity, MOVEMENT_LABELS } from '../lib/quantity';

const PAGE_SIZE = 30;

const MOVEMENT_TONES: Record<InventoryMovementType, BadgeTone> = {
  stock_in: 'success',
  sale: 'info',
  adjustment: 'warning',
};

interface MovementsSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
}

/** An item's stock history, newest first, with "Load more" paging. */
export function MovementsSheet({ item, onClose }: MovementsSheetProps) {
  const theme = useTheme();

  const query = useInfiniteQuery({
    queryKey: queryKeys.inventoryMovements(item?.id ?? ''),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => inventoryApi.movements(item!.id, pageParam as number, PAGE_SIZE),
    getNextPageParam: (last) => {
      const loaded = last.skip + last.items.length;
      return loaded < last.total ? loaded : undefined;
    },
    enabled: !!item,
  });

  const movements = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item ? `History · ${item.name}` : 'History'}
      description={item ? `On hand: ${formatQuantity(item.quantity, item.unit)}` : undefined}
    >
      {query.isLoading ? (
        <SkeletonList count={5} lines={1} />
      ) : movements.length === 0 ? (
        <Text variant="small" color="mutedForeground">
          No stock movements yet.
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {movements.map((movement) => (
            <View
              key={movement.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Badge
                  label={MOVEMENT_LABELS[movement.type] ?? movement.type}
                  tone={MOVEMENT_TONES[movement.type] ?? 'neutral'}
                  style={{ alignSelf: 'flex-start' }}
                />
                {movement.note ? (
                  <Text variant="small" numberOfLines={2}>
                    {movement.note}
                  </Text>
                ) : null}
                <Text variant="caption" color="mutedForeground">
                  {displayDate(movement.createdAt)} · {timeLabel(movement.createdAt)}
                </Text>
              </View>
              <Text
                variant="bodySemibold"
                color={movement.quantity < 0 ? 'destructive' : 'success'}
              >
                {movement.quantity > 0 ? '+' : ''}
                {item ? formatQuantity(movement.quantity, item.unit) : movement.quantity}
              </Text>
            </View>
          ))}

          {query.hasNextPage ? (
            <Button
              label={query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              variant="outline"
              onPress={() => void query.fetchNextPage()}
              loading={query.isFetchingNextPage}
              disabled={query.isFetchingNextPage}
            />
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
