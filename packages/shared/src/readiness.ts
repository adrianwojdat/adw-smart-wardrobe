/** Minimal information required for useful outfit matching. Availability is separate. */
export type StylingReadinessInput = {
  category: string;
  primary_color?: string | null;
  secondary_color?: string | null;
};

export function getStylingReadiness(garment: StylingReadinessInput) {
  const missing = garment.category?.trim() ? [] : ['category'];
  const hasColor = [garment.primary_color, garment.secondary_color].some((color) =>
    Boolean(color?.trim()),
  );

  if (!hasColor) missing.push('color');

  return { ready: missing.length === 0, missing };
}
