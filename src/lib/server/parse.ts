/** FastMCP returns one JSON text block per list element; parse them all. */

export interface TextContent {
  type: string;
  text?: string;
}

export function parseToolContent(content: TextContent[]): unknown[] {
  const items: unknown[] = [];
  for (const block of content) {
    if (block.type !== "text" || block.text === undefined) continue;
    const parsed: unknown = JSON.parse(block.text);
    if (Array.isArray(parsed)) items.push(...(parsed as unknown[]));
    else items.push(parsed);
  }
  return items;
}
