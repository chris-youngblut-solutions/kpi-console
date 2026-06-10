import { error, json } from "@sveltejs/kit";
import { describeLineage } from "$lib/server/mcp";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  try {
    return json(await describeLineage(params.node));
  } catch (err) {
    error(502, err instanceof Error ? err.message : "lineage failed");
  }
};
