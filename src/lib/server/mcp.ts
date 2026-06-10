/**
 * The MCP client seam. The console never touches DuckDB or composes SQL —
 * every number comes from the dbt-semantic-mcp server's governed tools
 * (list_metrics / query_metric / describe_lineage) over stdio.
 *
 * DBT_SEMANTIC_MCP_DIR must point at a checkout of dbt-semantic-mcp with a
 * built warehouse; the server is spawned as `uv run dbt-semantic-mcp` there.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "$env/dynamic/private";
import { parseToolContent, type TextContent } from "./parse";

export interface MetricInfo {
  name: string;
  label: string;
  type: string;
  description: string;
  group_bys: string[];
}

export interface QueryArgs {
  metrics: string[];
  group_by?: string[];
  start_time?: string;
  end_time?: string;
  order_by?: string[];
  limit?: number;
}

export interface LineageInfo {
  requested: string;
  resolved_node: string;
  unique_id: string;
  upstream: string[];
  downstream: string[];
}

let clientPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const dir = env.DBT_SEMANTIC_MCP_DIR;
  if (!dir) {
    throw new Error(
      "DBT_SEMANTIC_MCP_DIR is not set — point it at a dbt-semantic-mcp checkout (see README)",
    );
  }
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "dbt-semantic-mcp"],
    cwd: dir,
  });
  const client = new Client({ name: "kpi-console", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

function getClient(): Promise<Client> {
  clientPromise ??= connect().catch((error: unknown) => {
    clientPromise = null; // allow a retry after a failed spawn
    throw error;
  });
  return clientPromise;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown[]> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const text = (result.content as TextContent[]).map((block) => block.text ?? "").join("\n");
    throw new Error(`${name} failed: ${text}`);
  }
  return parseToolContent(result.content as TextContent[]);
}

export async function listMetrics(): Promise<MetricInfo[]> {
  return (await callTool("list_metrics", {})) as MetricInfo[];
}

export async function queryMetric(args: QueryArgs): Promise<Record<string, string>[]> {
  return (await callTool("query_metric", { ...args })) as Record<string, string>[];
}

export async function describeLineage(node: string): Promise<LineageInfo> {
  const items = await callTool("describe_lineage", { node_name: node });
  return items[0] as LineageInfo;
}
