export function lkr(value: number | string) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function signedLkr(value: number) {
  return `${value >= 0 ? "+" : "−"} ${lkr(Math.abs(value))}`;
}

export function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
