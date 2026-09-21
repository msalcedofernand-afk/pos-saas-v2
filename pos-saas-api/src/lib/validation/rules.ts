import { z } from "zod";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const limits = {
  categoryName: 100,
  productName: 150,
  description: 1000,
  orderNotes: 1000,
  itemNotes: 500,
  paymentReference: 200,
  differenceReason: 300,
  page: 10_000,
  limit: 100,
  quantity: 999,
  guests: 999,
  prepTimeMinutes: 999,
  sortOrder: 9_999,
  money: 99_999_999,
} as const;

export function boundedText(max: number, min = 0) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "No se permiten caracteres de control");
}

export function strictInteger(min: number, max: number) {
  return z.number().int().finite().min(min).max(max);
}

export function strictQueryInteger(min: number, max: number, defaultValue: number) {
  return z
    .string()
    .regex(/^\d+$/, "Debe ser un entero positivo")
    .transform(Number)
    .pipe(strictInteger(min, max))
    .default(defaultValue)
    .transform(Number);
}

export function money(max: number = limits.money) {
  return z
    .number()
    .finite()
    .min(0)
    .max(max)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Debe tener máximo dos decimales");
}

export function positiveMoney(max = limits.money) {
  return money(max).positive();
}

export const stockQuantity = z
  .number()
  .finite()
  .positive()
  .max(999_999.999)
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, "Debe tener máximo tres decimales");

export const uuid = z.string().uuid();
