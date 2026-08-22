import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Category, CategoryPayload } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface CategoryFormSheetProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  saving: boolean;
  onSubmit: (payload: CategoryPayload) => Promise<unknown>;
}

/** Create/edit a category. Two fields, matching the web dialog. */
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
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: category?.name ?? '', description: category?.description ?? '' });
  }, [open, category, reset]);

  const submit = (values: CategoryForm) =>
    onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
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
    </Sheet>
  );
}
