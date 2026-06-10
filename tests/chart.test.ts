import { describe, expect, it } from "vitest";
import { CHART_HEIGHT, shortLabel, toBars } from "../src/lib/chart";

describe("shortLabel", () => {
  it("truncates timestamps to dates and passes other labels through", () => {
    expect(shortLabel("2025-01-01T00:00:00")).toBe("2025-01-01");
    expect(shortLabel("west")).toBe("west");
  });
});

describe("toBars", () => {
  const rows = [
    { metric_time__year: "2024-01-01T00:00:00", revenue: "1198339" },
    { metric_time__year: "2025-01-01T00:00:00", revenue: "3304658" },
  ];

  it("scales the max value to the chart height", () => {
    const bars = toBars(rows, "metric_time__year", "revenue");
    expect(bars).toHaveLength(2);
    expect(bars[1].height).toBe(CHART_HEIGHT - 20);
    expect(bars[0].height).toBeLessThan(bars[1].height);
    expect(bars[0].label).toBe("2024-01-01");
  });

  it("returns nothing for non-numeric or empty input", () => {
    expect(toBars([], "a", "b")).toEqual([]);
    expect(toBars([{ a: "x", b: "not-a-number" }], "a", "b")).toEqual([]);
  });
});
