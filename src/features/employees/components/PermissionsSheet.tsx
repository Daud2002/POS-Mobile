import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { employeesApi } from '@/api/services';
import { Employee } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { PERMISSION_HINTS, PERMISSION_LABELS } from '@/lib/access';
import { useTheme } from '@/theme/ThemeProvider';

interface PermissionsSheetProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
}

/**
 * Owner-only module assignment for one staff member.
 *
 * The tickable list comes from the SERVER: what a waiter may be given differs
 * from what a cashier may be given, and keeping that rule in one place means a
 * change to it does not need a store release. The server re-filters on save
 * regardless, so this sheet cannot grant anything it shouldn't.
 */
export function PermissionsSheet({ open, onClose, employee }: PermissionsSheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: queryKeys.employeePermissions(employee?.id ?? ''),
    queryFn: () => employeesApi.permissions(employee!.id),
    enabled: open && !!employee,
  });

  // Seeded from the server response rather than held as form state: reopening
  // the sheet for a different person must not carry the last one's ticks.
  useEffect(() => {
    if (!query.data) return;
    setSelected(
      new Set(query.data.permissions.filter((permission) => permission !== query.data!.base)),
    );
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => employeesApi.setPermissions(employee!.id, [...selected]),
    onSuccess: () => {
      toast.success('Permissions updated');
      queryClient.invalidateQueries({
        queryKey: queryKeys.employeePermissions(employee!.id),
      });
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Could not save the permissions.',
      ),
  });

  const toggle = (permission: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const base = query.data?.base;
  const grantable = query.data?.grantable ?? [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={employee ? `Permissions · ${employee.name}` : 'Permissions'}
      footer={
        <>
          <Button
            label="Cancel"
            variant="outline"
            onPress={onClose}
            disabled={save.isPending}
            style={{ flex: 1 }}
          />
          <Button
            label={save.isPending ? 'Saving…' : 'Save'}
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={save.isPending || query.isLoading}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Text variant="caption" color="mutedForeground">
        Choose which modules this staff member can open. Changes apply the next time they load a
        screen.
      </Text>

      {query.isLoading ? (
        <SkeletonList count={4} lines={1} />
      ) : (
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: theme.spacing.sm }}>
            {base ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.muted,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                }}
              >
                <Lock size={16} color={theme.colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text variant="smallMedium">{PERMISSION_LABELS[base]}</Text>
                  <Text variant="caption" color="mutedForeground">
                    Always available — it's what their role does.
                  </Text>
                </View>
              </View>
            ) : null}

            {grantable.map((permission) => {
              const checked = selected.has(permission);
              return (
                <Pressable
                  key={permission}
                  onPress={() => toggle(permission)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    borderWidth: 1,
                    borderColor: checked ? theme.colors.primary : theme.colors.border,
                    backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                  })}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: checked ? theme.colors.primary : theme.colors.input,
                      backgroundColor: checked ? theme.colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {checked ? <Check size={14} color={theme.colors.primaryForeground} /> : null}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="smallMedium">{PERMISSION_LABELS[permission]}</Text>
                    <Text variant="caption" color="mutedForeground">
                      {PERMISSION_HINTS[permission]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {grantable.length === 0 ? (
              <Text variant="small" color="mutedForeground">
                There are no extra modules that can be assigned to this role.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}
