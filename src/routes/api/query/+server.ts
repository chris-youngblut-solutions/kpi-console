import { error, json } from "@sveltejs/kit";
import { type QueryArgs, queryMetric } from "$lib/server/mcp";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as QueryArgs;
  if (!Array.isArray(body.metrics) || body.metrics.length === 0) {
    error(400, "metrics is required");
  }
  try {
    return json(await queryMetric(body));
  } catch (err) {
    error(502, err instanceof Error ? err.message : "query failed");
  }
};
