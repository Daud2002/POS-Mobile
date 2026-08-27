import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, ShieldCheck, Trash2, UserSquare } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { employeesApi } from '@/api/services';
import { Employee, EmployeePayload } from '@/api/types';
import { PageFade } from '@/components/layout/PageFade';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useStoreId } from '@/hooks/useStoreId';
import { useTheme } from '@/theme/ThemeProvider';

import { EmployeeFormSheet } from '../components/EmployeeFormSheet';
import { PermissionsSheet } from '../components/PermissionsSheet';

/**
 * Store staff.
 *
 * The store comes straight from `user.storeId` (resolved by /auth/me). The web
 * version instead fetches every store and finds the one whose `userId` matches
 * the signed-in user, and renders an empty list if that lookup misses.
 */
export function EmployeesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const storeId = useStoreId();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  /** Whose module access is open for editing. Only owners reach this screen. */
  const [permissionsFor, setPermissionsFor] = useState<Employee | null>(null);

  const query = useQuery({
    queryKey: queryKeys.employees(storeId ?? ''),
    queryFn: () => employeesApi.listByStore(storeId!, 0, 1000),
    enabled: !!storeId,
  });

  const invalidate = () => {
    if (storeId) queryClient.invalidateQueries({ queryKey: queryKeys.employees(storeId) });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const save = useMutation({
    mutationFn: (payload: EmployeePayload) =>
      editing
        ? employeesApi.update(editing.id, payload)
        : employeesApi.create(storeId!, payload),
    onSuccess: () => {
      toast.success(editing ? 'Employee updated' : 'Employee added');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not save the employee.'),
  });

  // `isActive` lives on the linked User, not the Employee row — the backend
  // routes it there.
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      employeesApi.update(id, { isActive }),
    onSuccess: invalidate,
    onError: (error) => fail(error, 'Could not update the employee.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => employeesApi.remove(id),
    onSuccess: () => {
      toast.success('Employee removed');
      invalidate();
    },
    onError: (error) => fail(error, 'Could not remove the employee.'),
  });

  const employees = query.data ?? [];

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <PageFade>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
        <SectionHeader title="Employees" subtitle={`${employees.length} on staff`} />
      </View>

      {query.isLoading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <SkeletonList count={5} lines={1} />
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(employee) => employee.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No employees yet"
              description="Add staff so they can sign in and take orders on the POS."
              icon={<UserSquare size={28} color={theme.colors.mutedForeground} />}
              actionLabel="Add Employee"
              onAction={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            />
          }
          renderItem={({ item }) => (
            <Card padding="lg">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Badge label={item.designation} tone="accent" />
                  </View>

                  <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                    {[item.employeeId, item.email, item.phone].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                <Switch
                  value={item.user?.isActive ?? true}
                  onValueChange={(isActive) => toggleActive.mutate({ id: item.id, isActive })}
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.md,
                }}
              >
                <IconButton
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => {
                    setEditing(item);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={16} color={theme.colors.foreground} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`Permissions for ${item.name}`}
                  onPress={() => setPermissionsFor(item)}
                >
                  <ShieldCheck size={16} color={theme.colors.foreground} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`Remove ${item.name}`}
                  tone="destructive"
                  onPress={() => setDeleting(item)}
                >
                  <Trash2 size={16} color={theme.colors.destructive} />
                </IconButton>
              </View>
            </Card>
          )}
        />
      )}

      <Fab
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        accessibilityLabel="Add employee"
      />

      <EmployeeFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        employee={editing}
        saving={save.isPending}
        onSubmit={save.mutateAsync}
      />

      <PermissionsSheet
        open={!!permissionsFor}
        onClose={() => setPermissionsFor(null)}
        employee={permissionsFor}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Remove Employee"
        description={`"${deleting?.name}" will lose access to the POS.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onDecline={() => setDeleting(null)}
      />
      </PageFade>
    </SafeAreaView>
  );
}
