type ChartPoint = { label: string; value: number };
type Slice = { label: string; value: number; color: "green" | "blue" | "red" };

export function Sparkline({ label, points, tone = "green" }: { label: string; points: ChartPoint[]; tone?: "green" | "red" | "blue" }) {
  const values = points.map(point => point.value);
  const low = Math.min(...values, 0), high = Math.max(...values, 0), range = high - low || 1;
  const coordinates = points.map((point, index) => `${points.length === 1 ? 50 : 4 + index / (points.length - 1) * 92},${25 - (point.value - low) / range * 20}`).join(" ");
  const last = points.at(-1);
  return <svg className={`dashboard-sparkline ${tone}`} viewBox="0 0 100 30" role="img" aria-label={`${label}. Latest ${last?.label ?? ""}: ${last?.value.toFixed(2) ?? "0"}`}><line x1="4" x2="96" y1={25 - (0 - low) / range * 20} y2={25 - (0 - low) / range * 20} /><polyline points={coordinates} /><circle cx={coordinates.split(" ").at(-1)?.split(",")[0]} cy={coordinates.split(" ").at(-1)?.split(",")[1]} r="2.2" /></svg>;
}

export function TrendArrow({ points, inverse = false }: { points: ChartPoint[]; inverse?: boolean }) {
  const current = points.at(-1)?.value ?? 0;
  const previous = points.at(-2)?.value ?? current;
  const direction = current > previous ? "up" : current < previous ? "down" : "flat";
  const symbol = direction === "up" ? "▲" : direction === "down" ? "▼" : "◆";
  const change = previous === 0 ? current : (current - previous) / Math.abs(previous) * 100;
  return <span className={`trend-arrow ${direction}${inverse ? " inverse" : ""}`} aria-label={`${direction === "flat" ? "No change" : `${direction === "up" ? "Up" : "Down"} ${Math.abs(change).toFixed(1)} percent from last month`}`}>{symbol}</span>;
}

export function MiniDonut({ label, slices }: { label: string; slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;
  let offset = 0;
  return <svg className="dashboard-donut" viewBox="0 0 40 40" role="img" aria-label={`${label}: ${slices.map(slice => `${slice.label} ${slice.value.toFixed(2)}`).join(", ")}`}><circle className="track" cx="20" cy="20" r="15.5" />{slices.map(slice => { const length = Math.max(0, slice.value) / total * 97.4; const circle = <circle key={slice.label} className={slice.color} cx="20" cy="20" r="15.5" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-offset} />; offset += length; return circle; })}</svg>;
}
