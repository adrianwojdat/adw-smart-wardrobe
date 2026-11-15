import { useEffect, useRef } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { deriveWarmth, type GarmentInput, garmentInput } from '@wardrobe/shared';

export function useGarmentWarmth(
  form: UseFormReturn<z.input<typeof garmentInput>, unknown, GarmentInput>,
  editing: boolean,
  manualInEdit: boolean,
) {
  const category = useWatch({ control: form.control, name: 'category' });
  const subcategory = useWatch({ control: form.control, name: 'subcategory' });
  const previous = useRef(`${category}|${subcategory}`);
  const { setValue, getValues } = form;

  useEffect(() => {
    const next = `${category}|${subcategory}`;
    const changed = previous.current !== next;

    previous.current = next;
    if (manualInEdit || (editing && !changed)) return;

    const warmth = deriveWarmth(category, subcategory);

    if (changed && warmth !== undefined) setValue('warmth_manual', false, { shouldDirty: true });
    if (warmth !== undefined && getValues('warmth') !== warmth)
      setValue('warmth', warmth, { shouldDirty: changed, shouldValidate: true });
  }, [category, subcategory, manualInEdit, editing, setValue, getValues]);

  return category;
}
