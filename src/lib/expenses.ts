import { z } from "zod";

export const UNITS = ["kg", "g", "l", "ml", "each", "pack"] as const;
export const normalizeItem = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export const moneyCents = (value: number | string) => Math.round(Number(value) * 100);
export const lineSchema = z.object({
  name: z.string().trim().min(1).max(140), categoryId: z.string().min(1).max(191),
  quantity: z.preprocess(v => v === "" || v == null ? undefined : v, z.coerce.number().positive().max(999999999).refine(n => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001).optional()),
  unit: z.preprocess(v => v === "" || v == null ? undefined : v, z.enum(UNITS).optional()),
  amount: z.coerce.number().positive().max(999999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
}).refine(v => v.quantity == null || !!v.unit, "Choose a unit when entering quantity.");
export const linesSchema = z.array(lineSchema).max(100);
export type ExpenseInput = z.infer<typeof lineSchema>;
export function normalizedQuantity(quantity: number, unit: string) {
  if (unit === "g") return { quantity: quantity / 1000, unit: "kg" };
  if (unit === "ml") return { quantity: quantity / 1000, unit: "l" };
  return { quantity, unit };
}
