import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Employee, EmployeePayload } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordField } from '@/components/ui/PasswordField';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  // Required only when creating — enforced in the resolver below.
  password: z.string().optional(),
  employeeId: z.string().optional(),
  designation: z.string().min(1, 'Designation is required'),
  phone: z.string().optional(),
  joinDate: z.string().optional(),
  address: z.string().optional(),
  salary: z.string().optional(),
  isActive: z.boolean(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

interface EmployeeFormSheetProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  saving: boolean;
  onSubmit: (payload: EmployeePayload) => Promise<unknown>;
}

const EMPTY_FORM: EmployeeForm = {
  name: '',
  email: '',
  password: '',
  employeeId: '',
  designation: 'cashier',
  phone: '',
  joinDate: '',
  address: '',
  salary: '',
  isActive: true,
};

/**
 * Create/edit an employee.
 *
 * Creating one also creates the linked User account with role `employee`, which
 * is why the password field only appears on create — the backend has no way to
 * reset another user's password through this endpoint.
 */
export function EmployeeFormSheet({
  open,
  onClose,
  employee,
  saving,
  onSubmit,
}: EmployeeFormSheetProps) {
  const theme = useTheme();
  const isCreating = !employee;

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      employee
        ? {
            name: employee.name,
            email: employee.email,
            password: '',
            employeeId: employee.employeeId ?? '',
            designation: employee.designation ?? 'cashier',
            phone: employee.phone ?? '',
            joinDate: employee.joinDate ?? '',
            address: employee.address ?? '',
            salary: employee.salary ? String(toNumber(employee.salary)) : '',
            isActive: employee.user?.isActive ?? true,
          }
        : EMPTY_FORM,
    );
  }, [open, employee, reset]);

  const submit = async (values: EmployeeForm) => {
    if (isCreating && !values.password) {
      setError('password', { message: 'Set an initial login password' });
      return;
    }

    await onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      // Only sent when non-empty, so an edit never clears the password.
      password: values.password || undefined,
      employeeId: values.employeeId?.trim() || undefined,
      designation: values.designation.trim(),
      phone: values.phone?.trim() || undefined,
      joinDate: values.joinDate?.trim() || undefined,
      address: values.address?.trim() || undefined,
      salary: values.salary ? Number(values.salary) : undefined,
      isActive: values.isActive,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={employee ? 'Edit Employee' : 'New Employee'}
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
            label={saving ? 'Saving…' : employee ? 'Update' : 'Create'}
            onPress={handleSubmit(submit)}
            loading={saving}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Full name"
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Email"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="employee@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email?.message}
          />
        )}
      />

      {isCreating ? (
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordField
              label="Password"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Initial login password"
              error={errors.password?.message}
            />
          )}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="employeeId"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Employee ID"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. EMP001"
              autoCapitalize="characters"
            />
          )}
        />

        <Controller
          control={control}
          name="designation"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Designation"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Cashier"
              error={errors.designation?.message}
            />
          )}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Phone"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              keyboardType="phone-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="joinDate"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Join Date"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="address"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Optional"
            multiline
          />
        )}
      />

      <Controller
        control={control}
        name="salary"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Salary"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Optional"
            keyboardType="decimal-pad"
          />
        )}
      />

      <Controller
        control={control}
        name="isActive"
        render={({ field: { onChange, value } }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.lg,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="smallMedium">Active</Text>
              <Text variant="caption" color="mutedForeground">
                Inactive employees cannot sign in
              </Text>
            </View>
            <Switch value={value} onValueChange={onChange} />
          </View>
        )}
      />
    </Sheet>
  );
}
