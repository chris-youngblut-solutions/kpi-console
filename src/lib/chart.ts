/** Pure transform: query rows -> SVG bar geometry. No chart library — the
 * console renders these directly as <rect> elements. */

export interface Bar {
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 260;
const GAP = 4;

/** Shorten "2025-01-01 00:00:00" / ISO-T timestamps to their date part. */
export function shortLabel(raw: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(raw);
  return match ? match[1] : raw;
}

export function toBars(rows: Record<string, string>[], labelKey: string, valueKey: string): Bar[] {
  const values = rows.map((row) => Number(row[valueKey]));
  if (values.length === 0 || values.some(Number.isNaN)) return [];
  const max = Math.max(...values, 0);
  if (max <= 0) return [];
  const barWidth = (CHART_WIDTH - GAP * (rows.length - 1)) / rows.length;
  return rows.map((row, i) => {
    const value = Number(row[valueKey]);
    const height = Math.round((value / max) * (CHART_HEIGHT - 20));
    return {
      label: shortLabel(row[labelKey] ?? ""),
      value,
      x: Math.round(i * (barWidth + GAP)),
      y: CHART_HEIGHT - height,
      width: Math.floor(barWidth),
      height,
    };
  });
}
