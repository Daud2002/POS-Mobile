import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Category, CategoryPayload } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { IconPicker } from '@/components/ui/IconPicker';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { parseSortOrderInput } from '@/lib/sortOrder';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  /** Optional: a category with no icon simply lends none to its dishes. */
  image: z.string().optional(),
  /** Text from the field. Blank leaves the server to place a new one last. */
  sortOrder: z
    .string()
    .optional()
    .refine((value) => parseSortOrderInput(value ?? '') !== null, 'Enter a whole number'),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface CategoryFormSheetProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  saving: boolean;
  onSubmit: (payload: CategoryPayload) => Promise<unknown>;
}

/** Create/edit a category. Fields match the web dialog. */
export function CategoryFormSheet({
  open,
  onClose,
  category,
  saving,
  onSubmit,
}: CategoryFormSheetProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '', image: '', sortOrder: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: category?.name ?? '',
      description: category?.description ?? '',
      image: category?.image ?? '',
      sortOrder: category?.sortOrder == null ? '' : String(category.sortOrder),
    });
  }, [open, category, reset]);

  const submit = (values: CategoryForm) =>
    onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      // Null, not '', so a cleared icon reads as unset to every consumer.
      image: values.image || null,
      // Undefined when blank: a new category goes last; an edit keeps its
      // number. The schema has already refused anything unparseable.
      sortOrder: parseSortOrderInput(values.sortOrder ?? '') ?? undefined,
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? 'Edit Category' : 'New Category'}
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
            label={saving ? 'Saving…' : category ? 'Update' : 'Create'}
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
        name="image"
        render={({ field: { onChange, value } }) => (
          <IconPicker
            value={value}
            onChange={onChange}
            allowClear
            hint="Dishes with no icon of their own show this one."
          />
        )}
      />

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="e.g. Beverages"
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Description"
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
        name="sortOrder"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Sort"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="Auto"
            keyboardType="number-pad"
            hint="Lower numbers show first on the till. Each category needs its own; blank adds it at the end."
            error={errors.sortOrder?.message}
          />
        )}
      />
    </Sheet>
  );
}
