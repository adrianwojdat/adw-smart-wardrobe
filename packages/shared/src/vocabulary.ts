import { z } from 'zod';

export const uuid = z.uuid();

export const cleanliness = ['clean', 'worn', 'dirty', 'washing', 'drying', 'ironing'] as const;
export const cleanlinessLabels: Record<(typeof cleanliness)[number], string> = {
  clean: 'Clean',
  worn: 'Worn',
  dirty: 'Dirty',
  washing: 'Washing',
  drying: 'Drying',
  ironing: 'Ironing',
};

export const wearConditions = [
  'unknown',
  'new_with_tags',
  'new_without_tags',
  'very_good',
  'good',
  'satisfactory',
] as const;
export const wearConditionLabels: Record<(typeof wearConditions)[number], string> = {
  unknown: 'Not assessed',
  new_with_tags: 'New with tags',
  new_without_tags: 'New without tags',
  very_good: 'Very good',
  good: 'Good',
  satisfactory: 'Satisfactory',
};

export const categories = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
] as const;
export const categoryLabels: Record<(typeof categories)[number], string> = {
  tops: 'Tops',
  bottoms: 'Trousers and skirts',
  dresses: 'Dresses',
  outerwear: 'Outerwear',
  shoes: 'Footwear',
  accessories: 'Accessories',
};

export const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export const seasonLabels = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const occasions = ['office', 'everyday', 'date', 'evening', 'weekend', 'travel'] as const;
export const occasionLabels = {
  office: 'Office',
  everyday: 'Everyday',
  date: 'Date',
  evening: 'Evening',
  weekend: 'Weekend',
  travel: 'Travel',
};
