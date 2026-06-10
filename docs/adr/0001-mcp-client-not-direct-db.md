# ADR 0001 — Query through the MCP server, not the database

**Status:** accepted (2026-06-10)

## Context

The console needs warehouse numbers. The DuckDB file is right there — a direct
connection (or a SQL layer) would be fewer moving parts than spawning an MCP server
and speaking the protocol.

## Decision

All reads go through dbt-semantic-mcp's tools over a stdio MCP client in the
SvelteKit server routes. The console defines no metrics and composes no SQL.

## Consequences

- Metric definitions stay single-sourced in the warehouse repo's semantic YAML; the
  console cannot drift from what the analyst CLI or an LLM agent sees.
- The console demonstrates the seam it exists to demonstrate: a human UI as one more
  MCP client of a governed semantic layer.
- Cost: a Python process per console process and MetricFlow's ~2 s parse per query.
  Acceptable for a demo console; a production deployment would cache or pool.
