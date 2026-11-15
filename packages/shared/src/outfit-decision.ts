export interface Decision {
  rule: string;
  garment_ids: string[];
  value: number;
  reason?: string;
}
