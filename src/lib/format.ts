export function lkr(value: number | string) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(Number(value || 0)));
}

export function signedLkr(value: number) { return lkr(value); }

export function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
