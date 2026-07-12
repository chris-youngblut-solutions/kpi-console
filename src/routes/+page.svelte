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
	<p class="eyebrow">^ governed metrics</p>
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
					<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="2">
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
		max-width: 1120px;
		margin: 0 auto;
		padding: var(--s6) var(--s5) var(--s7);
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: var(--trk-label);
		text-transform: uppercase;
		color: var(--ink-accent);
		margin: 0 0 var(--s1);
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: var(--t-h1);
		line-height: var(--lh-heading);
		letter-spacing: var(--trk-heading);
		margin: 0 0 var(--s1);
	}
	.sub {
		color: var(--ink-3);
		font-size: var(--t-small);
		max-width: 44rem;
		margin: 0 0 var(--s5);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s3);
		align-items: end;
		padding: var(--s4);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r3);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--s1);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: var(--trk-label);
		text-transform: uppercase;
		color: var(--ink-3);
	}
	select,
	input {
		font-family: var(--font-sans);
		font-size: var(--t-small);
		color: var(--ink);
		padding: var(--s2) var(--s3);
		border: 1px solid var(--rule-2);
		border-radius: var(--r2);
		background: var(--inset);
	}
	button {
		font-family: var(--font-sans);
		font-size: var(--t-small);
		font-weight: 500;
		padding: var(--s2) var(--s5);
		border: none;
		border-radius: var(--r2);
		background: var(--copper);
		color: var(--on-copper);
		box-shadow: var(--shadow-1);
		cursor: pointer;
		transition:
			background var(--t-fast) var(--ease),
			transform var(--t-fast) var(--ease);
	}
	button:hover:not(:disabled) {
		background: var(--copper-deep);
	}
	button:active:not(:disabled) {
		background: var(--copper-deep);
		transform: translateY(1px);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.ghost {
		background: transparent;
		color: var(--ink-2);
		border: 1px solid var(--rule-2);
		box-shadow: none;
	}
	button.ghost:hover:not(:disabled) {
		background: var(--paper-2);
		border-color: var(--rule-3);
	}
	.description {
		font-size: var(--t-small);
		color: var(--ink-3);
	}
	.error {
		color: var(--ink-danger);
		background: var(--danger-soft);
		border: 1px solid var(--rule);
		padding: var(--s2) var(--s3);
		border-radius: var(--r2);
	}
	.lineage {
		font-size: var(--t-small);
		background: var(--paper-3);
		border: 1px solid var(--rule);
		padding: var(--s3) var(--s4);
		border-radius: var(--r3);
	}
	.lineage h2 {
		font-family: var(--font-sans);
		font-size: var(--t-body);
		font-weight: 600;
		margin: 0 0 var(--s1);
	}
	svg {
		width: 100%;
		height: auto;
		margin-top: var(--s5);
	}
	rect {
		fill: var(--fill-accent);
		transition: opacity var(--t-fast) var(--ease);
	}
	rect:hover {
		opacity: 0.82;
	}
	text {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: var(--trk-mono);
		fill: var(--ink-3);
	}
	table {
		border-collapse: collapse;
		margin-top: var(--s5);
		width: 100%;
	}
	th,
	td {
		padding: var(--s2) var(--s3);
		text-align: right;
		border-bottom: 1px solid var(--rule);
	}
	th:first-child,
	td:first-child {
		text-align: left;
	}
	th {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: var(--trk-label);
		text-transform: uppercase;
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule-2);
	}
	td {
		font-family: var(--font-mono);
		font-size: var(--t-mono);
		letter-spacing: var(--trk-mono);
		color: var(--ink-2);
	}
</style>
