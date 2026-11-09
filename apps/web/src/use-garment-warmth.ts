import { useEffect, useRef } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { deriveWarmth, garmentInput, type GarmentInput } from '@wardrobe/shared';
export function useGarmentWarmth(
  form: UseFormReturn<z.input<typeof garmentInput>, unknown, GarmentInput>,
  editing: boolean,
) {
  const category = useWatch({ control: form.control, name: 'category' });
  const subcategory = useWatch({ control: form.control, name: 'subcategory' });
  const manual = useWatch({ control: form.control, name: 'warmth_manual' });
  const previous = useRef(`${category}|${subcategory}`);
  const { setValue, getValues } = form;
  useEffect(() => {
    const next = `${category}|${subcategory}`;
    const changed = previous.current !== next;
    previous.current = next;
    if (manual || (editing && !changed)) return;
    const warmth = deriveWarmth(category, subcategory);
    if (warmth !== undefined && getValues('warmth') !== warmth)
      setValue('warmth', warmth, { shouldDirty: changed, shouldValidate: true });
  }, [category, subcategory, manual, editing, setValue, getValues]);
  return category;
}
