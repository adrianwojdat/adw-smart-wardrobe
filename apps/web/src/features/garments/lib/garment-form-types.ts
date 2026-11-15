import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { type GarmentInput, garmentInput } from '@wardrobe/shared';

export type GarmentFormMethods = UseFormReturn<z.input<typeof garmentInput>, unknown, GarmentInput>;
