import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/app/providers/AuthProvider';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { inventoryApi } from '@/api/services';
import { Category, Product, ProductPayload, RecipeLine } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { IconPicker } from '@/components/ui/IconPicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_PRODUCT_EMOJI } from '@/constants/emojis';
import { toNumber } from '@/lib/format';
import { parseSortOrderInput } from '@/lib/sortOrder';
import { useTheme } from '@/theme/ThemeProvider';
import { RecipeEditor, RecipeOption } from '@/features/inventory/components/RecipeEditor';
import {
  recipeLinesFromRows,
  RecipeRow,
  rowsFromRecipe,
} from '@/features/inventory/lib/recipe';

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
  /** Text from the field. Blank leaves the server to place a new one last. */
  sortOrder: z
    .string()
    .optional()
    .refine((value) => parseSortOrderInput(value ?? '') !== null, 'Enter a whole number'),
});

type ProductForm = z.infer<typeof productSchema>;

interface ProductFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Null means "create". */
  product: Product | null;
  categories: Category[];
  saving: boolean;
  /** Resolves to the saved product — its id is needed to save a new product's recipe. */
  onSubmit: (payload: ProductPayload) => Promise<Product>;
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
  sortOrder: '',
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
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Recipes exist on restaurant accounts only: a general store sells whole
  // units and tracks them through `stock` instead.
  const isRestaurant = user?.accountType === 'restaurant';

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: EMPTY_FORM,
  });

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [recipeError, setRecipeError] = useState<string>();
  const [savingRecipe, setSavingRecipe] = useState(false);
  // A ref, not state: the load effect below must see a reset made in the
  // same commit, and a refetch must never overwrite rows being edited.
  const recipeDirty = useRef(false);

  // Shares the Inventory screen's cache entry, retired items included, so a
  // recipe still naming a retired item can show its name.
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory('with-inactive'),
    queryFn: () => inventoryApi.list({ includeInactive: true }),
    enabled: open && isRestaurant,
  });

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(product?.id ?? ''),
    queryFn: () => inventoryApi.getRecipe(product!.id),
    enabled: open && isRestaurant && !!product,
  });

  const recipeOptions = useMemo<RecipeOption[]>(() => {
    const options: RecipeOption[] = (inventoryQuery.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      isActive: item.isActive,
    }));
    const known = new Set(options.map((option) => option.id));
    for (const line of recipeQuery.data ?? []) {
      if (!known.has(line.inventoryItemId)) {
        options.push({
          id: line.inventoryItemId,
          name: line.name,
          unit: line.unit,
          isActive: line.isActive,
        });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventoryQuery.data, recipeQuery.data]);

  useEffect(() => {
    if (!open) return;
    recipeDirty.current = false;
    setRecipeRows([]);
    setRecipeError(undefined);
  }, [open, product]);

  useEffect(() => {
    if (!open || !recipeQuery.data || recipeDirty.current) return;
    setRecipeRows(rowsFromRecipe(recipeQuery.data));
  }, [open, recipeQuery.data]);

  const changeRecipe = (rows: RecipeRow[]) => {
    recipeDirty.current = true;
    setRecipeError(undefined);
    setRecipeRows(rows);
  };

  // Editing a recipe that failed to load would PUT over lines never shown.
  const recipeUnavailable = !!product && recipeQuery.isError;
  const recipeLoading = !!product && recipeQuery.isLoading;

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
            sortOrder: product.sortOrder == null ? '' : String(product.sortOrder),
          }
        : EMPTY_FORM,
    );
  }, [open, product, reset]);

  const submit = async (values: ProductForm) => {
    // Checked before the product is saved, so a bad row never leaves a
    // product saved without the recipe the owner thought they entered.
    let recipeLines: RecipeLine[] | null = null;
    if (isRestaurant && recipeDirty.current && !recipeUnavailable) {
      const parsed = recipeLinesFromRows(recipeRows);
      if (parsed.error !== undefined) {
        setRecipeError(parsed.error);
        return;
      }
      recipeLines = parsed.lines;
    }

    const saved = await onSubmit({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      price: Number(values.price),
      // Drives the profit figure on the owner dashboard. This was previously
      // hardcoded to 0 on both clients, which made reported profit equal to
      // revenue.
      costPrice: values.costPrice?.trim() ? Number(values.costPrice) : null,
      stock: Number(values.stock),
      lowStockAlertQuantity: Number(values.lowStockAlertQuantity),
      sku: values.sku?.trim() || undefined,
      barcode: values.barcode?.trim() || undefined,
      image: values.image,
      categoryId: values.categoryId,
      // Undefined when blank: a new product goes last; an edit keeps its
      // number. The schema has already refused anything unparseable.
      sortOrder: parseSortOrderInput(values.sortOrder ?? '') ?? undefined,
    });

    // The recipe is its own resource keyed by product id, so it can only be
    // written once the product exists.
    if (recipeLines && saved?.id) {
      setSavingRecipe(true);
      try {
        const recipe = await inventoryApi.setRecipe(saved.id, recipeLines);
        queryClient.setQueryData(queryKeys.recipe(saved.id), recipe);
      } catch (error) {
        toast.error(
          `Product saved, but its ingredients were not: ${
            error instanceof ApiError ? error.message : 'please try again.'
          }`,
        );
      } finally {
        setSavingRecipe(false);
      }
    }
    onClose();
  };

  const busy = saving || savingRecipe;

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
            disabled={busy}
            style={{ flex: 1 }}
          />
          <Button
            label={busy ? 'Saving…' : product ? 'Update' : 'Create'}
            onPress={handleSubmit(submit)}
            loading={busy}
            disabled={busy}
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

      {/* Profit reads this as-is; the ingredients below only move stock. */}
      <Controller
        control={control}
        name="costPrice"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Cost price"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="0.00"
            keyboardType="decimal-pad"
            error={errors.costPrice?.message}
          />
        )}
      />

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
            hint="Lower numbers show first on the till. Each product needs its own; blank adds it at the end."
            error={errors.sortOrder?.message}
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

      {isRestaurant ? (
        recipeUnavailable ? (
          <Text variant="caption" color="destructive">
            Could not load this item’s ingredients. Close and reopen to edit them.
          </Text>
        ) : (
          <RecipeEditor
            rows={recipeRows}
            onChange={changeRecipe}
            options={recipeOptions}
            loading={recipeLoading}
            error={recipeError}
          />
        )
      ) : null}
    </Sheet>
  );
}
