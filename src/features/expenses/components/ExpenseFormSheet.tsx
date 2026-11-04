import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
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

/** The picker's "no category" sentinel — the API wants null, not a uuid. */
const NO_CATEGORY = 'none';
/** "No subcategory", likewise null on the wire. */
const NO_SUBCATEGORY = 'none';
/** "＋ New…": the name typed below is sent and filed under the category. */
const NEW_SUBCATEGORY = 'new';

const expenseSchema = z
  .object({
    title: z.string().min(1, 'What was this for?'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((value) => Number(value) > 0, 'Enter an amount greater than zero'),
    categoryId: z.string(),
    subcategoryId: z.string(),
    subcategoryName: z.string().optional(),
    expenseDate: z.string().regex(DATE_ONLY, 'Use YYYY-MM-DD'),
    paymentMethod: z.string(),
    notes: z.string().optional(),
  })
  .refine(
    (values) => values.subcategoryId !== NEW_SUBCATEGORY || !!values.subcategoryName?.trim(),
    { path: ['subcategoryName'], message: 'Name the new subcategory' },
  );

type ExpenseForm = z.infer<typeof expenseSchema>;

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: '',
      categoryId: NO_CATEGORY,
      subcategoryId: NO_SUBCATEGORY,
      subcategoryName: '',
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
      subcategoryId: expense?.subcategoryId ?? NO_SUBCATEGORY,
      subcategoryName: '',
      // Already a plain day; never re-derive it through a Date, which would
      // apply the device offset and can move it back a day.
      expenseDate: expense?.expenseDate ?? localDateKey(new Date()),
      paymentMethod: expense?.paymentMethod ?? 'cash',
      notes: expense?.notes ?? '',
    });
  }, [open, expense, reset]);

  const submit = async (values: ExpenseForm) => {
    const categoryId = values.categoryId === NO_CATEGORY ? null : values.categoryId;
    // A typed name is found or filed under the category by the server; an
    // existing one goes by id; "No subcategory" clears it.
    const subcategory =
      !categoryId || values.subcategoryId === NO_SUBCATEGORY
        ? { subcategoryId: null }
        : values.subcategoryId === NEW_SUBCATEGORY
          ? { subcategoryName: values.subcategoryName?.trim() }
          : { subcategoryId: values.subcategoryId };
    await onSubmit({
      title: values.title.trim(),
      // Rounded to 2dp — the API rejects more, and a pasted value can easily
      // carry a third decimal.
      amount: Math.round(Number(values.amount) * 100) / 100,
      categoryId,
      ...subcategory,
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

  const categoryId = watch('categoryId');
  const subcategoryId = watch('subcategoryId');
  const subcategoryOptions = useMemo(() => {
    const subs = categories.find((c) => c.id === categoryId)?.subcategories ?? [];
    const options = subs.map((s) => ({ value: s.id, label: s.name }));
    // An expense filed under a since-retired subcategory still shows it, so
    // opening the form does not silently move the expense out of it.
    const current = expense?.subcategory;
    if (current && current.categoryId === categoryId && !subs.some((s) => s.id === current.id)) {
      options.push({ value: current.id, label: current.name });
    }
    return [
      { value: NO_SUBCATEGORY, label: 'No subcategory' },
      ...options,
      { value: NEW_SUBCATEGORY, label: '＋ New…' },
    ];
  }, [categories, categoryId, expense]);

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
            onChange={(next) => {
              onChange(next);
              // A subcategory belongs to one category only.
              setValue('subcategoryId', NO_SUBCATEGORY);
              setValue('subcategoryName', '');
            }}
          />
        )}
      />

      {categoryId !== NO_CATEGORY ? (
        <Controller
          control={control}
          name="subcategoryId"
          render={({ field: { onChange, value } }) => (
            <Select
              label="Subcategory"
              value={value}
              options={subcategoryOptions}
              onChange={onChange}
            />
          )}
        />
      ) : null}

      {categoryId !== NO_CATEGORY && subcategoryId === NEW_SUBCATEGORY ? (
        <Controller
          control={control}
          name="subcategoryName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="New subcategory"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Ahmad"
              autoFocus
              error={errors.subcategoryName?.message}
            />
          )}
        />
      ) : null}

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
