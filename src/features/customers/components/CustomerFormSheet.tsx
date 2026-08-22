import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Customer, CustomerPayload } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

/** Name, phone and address are NOT NULL on the customers table. */
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  email: z
    .string()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  city: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

interface CustomerFormSheetProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  saving: boolean;
  onSubmit: (payload: CustomerPayload) => Promise<unknown>;
}

export function CustomerFormSheet({
  open,
  onClose,
  customer,
  saving,
  onSubmit,
}: CustomerFormSheetProps) {
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', address: '', email: '', city: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      email: customer?.email ?? '',
      city: customer?.city ?? '',
    });
  }, [open, customer, reset]);

  const submit = (values: CustomerForm) =>
    onSubmit({
      name: values.name.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      email: values.email?.trim() || undefined,
      city: values.city?.trim() || undefined,
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'New Customer'}
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
            label={saving ? 'Saving…' : customer ? 'Update' : 'Create'}
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
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Phone Number"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="+92 300 1234567"
            keyboardType="phone-pad"
            error={errors.phone?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="address"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Street address"
            multiline
            error={errors.address?.message}
          />
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="City"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
            />
          )}
        />
      </View>
    </Sheet>
  );
}
