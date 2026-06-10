import { json } from "@sveltejs/kit";
import { listMetrics } from "$lib/server/mcp";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  return json(await listMetrics());
};
