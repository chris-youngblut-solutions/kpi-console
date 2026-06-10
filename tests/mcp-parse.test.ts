import { describe, expect, it } from "vitest";
import { parseToolContent } from "../src/lib/server/parse";

describe("parseToolContent", () => {
  it("flattens one-JSON-text-block-per-row FastMCP output", () => {
    const content = [
      { type: "text", text: '{"region": "west", "revenue": "100"}' },
      { type: "text", text: '{"region": "east", "revenue": "200"}' },
    ];
    expect(parseToolContent(content)).toEqual([
      { region: "west", revenue: "100" },
      { region: "east", revenue: "200" },
    ]);
  });

  it("spreads JSON arrays and ignores non-text blocks", () => {
    const content = [{ type: "text", text: '[{"a": 1}, {"a": 2}]' }, { type: "image" }];
    expect(parseToolContent(content)).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
