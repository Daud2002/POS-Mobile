import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Expense, ExpenseCategory, ExpensePayload, ExpensePaymentMethod } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { localDateKey } from '@/lib/date';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

const PAYMENT_METHODS: Array<{ value: ExpensePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

/** The API rejects anything that is not a bare calendar day. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const expenseSchema = z.object({
  title: z.string().min(1, 'What was this for?'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => Number(value) > 0, 'Enter an amount greater than zero'),
  categoryId: z.string(),
  expenseDate: z.string().regex(DATE_ONLY, 'Use YYYY-MM-DD'),
  paymentMethod: z.string(),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

/** The picker's "no category" sentinel — the API wants null, not a uuid. */
const NO_CATEGORY = 'none';

interface ExpenseFormSheetProps {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  categories: ExpenseCategory[];
  saving: boolean;
  onSubmit: (payload: ExpensePayload) => Promise<unknown>;
}

export function ExpenseFormSheet({
  open,
  onClose,
  expense,
  categories,
  saving,
  onSubmit,
}: ExpenseFormSheetProps) {
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: '',
      categoryId: NO_CATEGORY,
      expenseDate: localDateKey(new Date()),
      paymentMethod: 'cash',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      title: expense?.title ?? '',
      amount: expense ? String(toNumber(expense.amount)) : '',
      categoryId: expense?.categoryId ?? NO_CATEGORY,
      // Already a plain day; never re-derive it through a Date, which would
      // apply the device offset and can move it back a day.
      expenseDate: expense?.expenseDate ?? localDateKey(new Date()),
      paymentMethod: expense?.paymentMethod ?? 'cash',
      notes: expense?.notes ?? '',
    });
  }, [open, expense, reset]);

  const submit = async (values: ExpenseForm) => {
    await onSubmit({
      title: values.title.trim(),
      // Rounded to 2dp — the API rejects more, and a pasted value can easily
      // carry a third decimal.
      amount: Math.round(Number(values.amount) * 100) / 100,
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
      expenseDate: values.expenseDate,
      paymentMethod: values.paymentMethod as ExpensePaymentMethod,
      notes: values.notes?.trim() || undefined,
    });
    onClose();
  };

  const categoryOptions = [
    { value: NO_CATEGORY, label: 'Uncategorized' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? 'Edit Expense' : 'New Expense'}
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
            label={saving ? 'Saving…' : expense ? 'Update' : 'Record'}
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
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="What was it for"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="e.g. October electricity bill"
            error={errors.title?.message}
          />
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Amount"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
              error={errors.amount?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="expenseDate"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Date"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
              error={errors.expenseDate?.message}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="categoryId"
        render={({ field: { onChange, value } }) => (
          <Select
            label="Category"
            value={value}
            options={categoryOptions}
            onChange={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="paymentMethod"
        render={({ field: { onChange, value } }) => (
          <Select
            label="Paid by"
            value={value}
            options={PAYMENT_METHODS}
            onChange={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Notes"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Invoice number, vendor, anything worth remembering"
            multiline
          />
        )}
      />
    </Sheet>
  );
}
