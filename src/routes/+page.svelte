<script lang="ts">
import { type Bar, CHART_HEIGHT, CHART_WIDTH, toBars } from "$lib/chart";

interface MetricInfo {
  name: string;
  label: string;
  type: string;
  description: string;
  group_bys: string[];
}
interface LineageInfo {
  resolved_node: string;
  upstream: string[];
  downstream: string[];
}

const GRAINS = ["day", "week", "month", "quarter", "year"];

let metrics = $state<MetricInfo[]>([]);
let selected = $state<string>("");
let groupBy = $state<string>("metric_time");
let grain = $state<string>("month");
let startTime = $state<string>("");
let endTime = $state<string>("");
let rows = $state<Record<string, string>[]>([]);
let lineage = $state<LineageInfo | null>(null);
let loadError = $state<string>("");
let running = $state(false);

const metric = $derived(metrics.find((m) => m.name === selected));
const groupByResolved = $derived(groupBy === "metric_time" ? `metric_time__${grain}` : groupBy);
const columns = $derived(rows.length > 0 ? Object.keys(rows[0]) : []);
const bars = $derived.by((): Bar[] => {
  if (rows.length === 0 || columns.length < 2 || !selected) return [];
  return toBars(rows, columns[0], selected);
});

$effect(() => {
  void (async () => {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error(await res.text());
      metrics = (await res.json()) as MetricInfo[];
      if (metrics.length > 0) selected = metrics[0].name;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "failed to load metrics";
    }
  })();
});

async function run() {
  if (!selected) return;
  running = true;
  loadError = "";
  lineage = null;
  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metrics: [selected],
        group_by: [groupByResolved],
        order_by: [groupByResolved],
        ...(startTime ? { start_time: startTime } : {}),
        ...(endTime ? { end_time: endTime } : {}),
      }),
    });
    if (!res.ok)
      throw new Error(((await res.json()) as { message?: string }).message ?? "query failed");
    rows = (await res.json()) as Record<string, string>[];
  } catch (err) {
    rows = [];
    loadError = err instanceof Error ? err.message : "query failed";
  } finally {
    running = false;
  }
}

async function showLineage() {
  if (!selected) return;
  const res = await fetch(`/api/lineage/${selected}`);
  if (res.ok) lineage = (await res.json()) as LineageInfo;
}

function fmt(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
</script>

<svelte:head>
	<title>KPI console</title>
</svelte:head>

<main>
	<h1>KPI console</h1>
	<p class="sub">
		Governed metrics from a dbt + MetricFlow warehouse, served over MCP. The console holds no
		metric definitions — it queries the same semantic layer an analyst's CLI does.
	</p>

	{#if loadError}<p class="error">{loadError}</p>{/if}

	<section class="controls">
		<label>
			Metric
			<select bind:value={selected}>
				{#each metrics as m (m.name)}
					<option value={m.name}>{m.label} ({m.type})</option>
				{/each}
			</select>
		</label>
		<label>
			Group by
			<select bind:value={groupBy}>
				{#each metric?.group_bys ?? [] as g (g)}
					<option value={g}>{g}</option>
				{/each}
			</select>
		</label>
		{#if groupBy === 'metric_time'}
			<label>
				Grain
				<select bind:value={grain}>
					{#each GRAINS as g (g)}<option value={g}>{g}</option>{/each}
				</select>
			</label>
		{/if}
		<label>From <input type="date" bind:value={startTime} /></label>
		<label>To <input type="date" bind:value={endTime} /></label>
		<button onclick={run} disabled={running || !selected}>
			{running ? 'Running…' : 'Run'}
		</button>
		<button class="ghost" onclick={showLineage} disabled={!selected}>Lineage</button>
	</section>

	{#if metric}
		<p class="description">{metric.description}</p>
	{/if}

	{#if lineage}
		<section class="lineage">
			<h2>Where this number comes from</h2>
			<p>
				<code>{selected}</code> reads from <code>{lineage.resolved_node}</code>
				&larr; {#each lineage.upstream as node, i (node)}{i > 0 ? ', ' : ''}<code>{node}</code
				>{/each}
			</p>
		</section>
	{/if}

	{#if bars.length > 0}
		<section>
			<svg
				viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT + 40}"
				role="img"
				aria-label="bar chart of {selected}"
			>
				{#each bars as bar (bar.x)}
					<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height}>
						<title>{bar.label}: {bar.value}</title>
					</rect>
					{#if bars.length <= 16}
						<text x={bar.x + bar.width / 2} y={CHART_HEIGHT + 16} text-anchor="middle">
							{bar.label}
						</text>
					{/if}
				{/each}
			</svg>
		</section>
	{/if}

	{#if rows.length > 0}
		<table>
			<thead>
				<tr>{#each columns as col (col)}<th>{col}</th>{/each}</tr>
			</thead>
			<tbody>
				{#each rows as row, i (i)}
					<tr>{#each columns as col (col)}<td>{fmt(row[col])}</td>{/each}</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
		color: #1a2330;
	}
	h1 {
		margin-bottom: 0.25rem;
	}
	.sub {
		color: #51607a;
		margin-top: 0;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
		padding: 0.75rem;
		background: #f2f5f9;
		border-radius: 8px;
	}
	label {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		gap: 0.25rem;
	}
	select,
	input {
		padding: 0.35rem;
		border: 1px solid #c4cedd;
		border-radius: 4px;
		background: #fff;
	}
	button {
		padding: 0.45rem 1.1rem;
		border: none;
		border-radius: 4px;
		background: #1f5eff;
		color: #fff;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.ghost {
		background: transparent;
		color: #1f5eff;
		border: 1px solid #1f5eff;
	}
	.description {
		font-size: 0.9rem;
		color: #51607a;
	}
	.error {
		color: #b3261e;
		background: #fdeeee;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
	}
	.lineage {
		font-size: 0.9rem;
		background: #f7f4ec;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
	}
	.lineage h2 {
		font-size: 0.95rem;
		margin: 0 0 0.25rem;
	}
	svg {
		width: 100%;
		height: auto;
		margin-top: 1rem;
	}
	rect {
		fill: #1f5eff;
	}
	text {
		font-size: 11px;
		fill: #51607a;
	}
	table {
		border-collapse: collapse;
		margin-top: 1rem;
		width: 100%;
		font-size: 0.85rem;
	}
	th,
	td {
		border: 1px solid #dbe2ec;
		padding: 0.35rem 0.6rem;
		text-align: right;
	}
	th:first-child,
	td:first-child {
		text-align: left;
	}
	th {
		background: #f2f5f9;
	}
</style>
