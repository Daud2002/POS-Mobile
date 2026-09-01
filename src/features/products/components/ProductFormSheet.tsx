import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Category, Product, ProductPayload } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { IconPicker } from '@/components/ui/IconPicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { DEFAULT_PRODUCT_EMOJI } from '@/constants/emojis';
import { toNumber } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** Numeric fields arrive as strings from TextInput, so parse and validate here. */
const numericString = (message: string) =>
  z
    .string()
    .min(1, message)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, message);

const productSchema = z.object({
  image: z.string().min(1, 'Pick an icon'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: numericString('Enter a valid price'),
  /** Optional: legacy products have no cost, and profit reporting tolerates that. */
  costPrice: z.string().optional(),
  stock: numericString('Enter a valid stock quantity'),
  lowStockAlertQuantity: numericString('Enter a low-stock threshold'),
  categoryId: z.string().min(1, 'Choose a category'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

interface ProductFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Null means "create". */
  product: Product | null;
  categories: Category[];
  saving: boolean;
  onSubmit: (payload: ProductPayload) => Promise<unknown>;
}

const EMPTY_FORM: ProductForm = {
  image: DEFAULT_PRODUCT_EMOJI,
  name: '',
  description: '',
  price: '',
  costPrice: '',
  stock: '',
  // Matches the web form's default.
  lowStockAlertQuantity: '5',
  categoryId: '',
  sku: '',
  barcode: '',
};

/** Create/edit product form. Fields mirror the web dialog exactly. */
export function ProductFormSheet({
  open,
  onClose,
  product,
  categories,
  saving,
  onSubmit,
}: ProductFormSheetProps) {
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: EMPTY_FORM,
  });

  // Repopulate whenever the sheet opens, so editing one product then another
  // never shows stale values.
  useEffect(() => {
    if (!open) return;

    reset(
      product
        ? {
            image: product.image || DEFAULT_PRODUCT_EMOJI,
            name: product.name,
            description: product.description ?? '',
            price: String(toNumber(product.price)),
            // Blank rather than 0 when unset, so "no cost recorded" stays
            // visible instead of being silently saved as a zero cost.
            costPrice:
              product.costPrice === null || product.costPrice === undefined
                ? ''
                : String(toNumber(product.costPrice)),
            stock: String(product.stock),
            lowStockAlertQuantity: String(product.lowStockAlertQuantity ?? 5),
            categoryId: product.categoryId ?? '',
            sku: product.sku ?? '',
            barcode: product.barcode ?? '',
          }
        : EMPTY_FORM,
    );
  }, [open, product, reset]);

  const submit = async (values: ProductForm) => {
    await onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      price: Number(values.price),
      // Drives the profit figure on the owner dashboard. This was previously
      // hardcoded to 0 on both clients, which made reported profit equal to
      // revenue.
      costPrice: values.costPrice ? Number(values.costPrice) : 0,
      stock: Number(values.stock),
      lowStockAlertQuantity: Number(values.lowStockAlertQuantity),
      sku: values.sku?.trim() || undefined,
      barcode: values.barcode?.trim() || undefined,
      image: values.image,
      categoryId: values.categoryId,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product ? 'Edit Product' : 'New Product'}
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
            label={saving ? 'Saving…' : product ? 'Update' : 'Create'}
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
          <IconPicker value={value} onChange={onChange} error={errors.image?.message} />
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
            placeholder="e.g. Coca Cola 1.5L"
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

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="price"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Price"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
              error={errors.price?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="costPrice"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Cost"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
              hint="Used to calculate profit"
              error={errors.costPrice?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="stock"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Stock"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0"
              keyboardType="number-pad"
              error={errors.stock?.message}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="lowStockAlertQuantity"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Low stock alert at"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="5"
            keyboardType="number-pad"
            hint="Warn once stock falls below this number"
            error={errors.lowStockAlertQuantity?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="categoryId"
        render={({ field: { onChange, value } }) => (
          <Select
            label="Category"
            value={value}
            onChange={onChange}
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            placeholder="Choose a category"
            error={errors.categoryId?.message}
          />
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="sku"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="SKU"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. LAP-001"
              autoCapitalize="characters"
            />
          )}
        />

        <Controller
          control={control}
          name="barcode"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              containerStyle={{ flex: 1 }}
              label="Barcode"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. 123456789"
              keyboardType="number-pad"
            />
          )}
        />
      </View>
    </Sheet>
  );
}
