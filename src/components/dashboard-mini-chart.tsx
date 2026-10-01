type ChartPoint = { label: string; value: number };
export function TrendArrow({ points, inverse = false }: { points: ChartPoint[]; inverse?: boolean }) {
  const current = points.at(-1)?.value ?? 0;
  const previous = points.at(-2)?.value ?? current;
  const direction = current > previous ? "up" : current < previous ? "down" : "flat";
  const symbol = direction === "up" ? "▲" : direction === "down" ? "▼" : "◆";
  const change = previous === 0 ? current : (current - previous) / Math.abs(previous) * 100;
  return <span className={`trend-arrow ${direction}${inverse ? " inverse" : ""}`} aria-label={`${direction === "flat" ? "No change" : `${direction === "up" ? "Up" : "Down"} ${Math.abs(change).toFixed(1)} percent from last month`}`}>{symbol}</span>;
}
