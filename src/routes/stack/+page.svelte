<script lang="ts">
	import Dices from '@lucide/svelte/icons/dices';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import Segmented from '#lib/components/drape/Segmented.svelte';
	import SimShell from '#lib/components/site/SimShell.svelte';
	import Overlay from '#lib/components/site/Overlay.svelte';
	import Figures from '#lib/components/site/Figures.svelte';
	import RunControls from '#lib/components/site/RunControls.svelte';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import { saveRun } from '#lib/components/site/save.js';
	import View from '#lib/scene/stack/View.svelte';
	import { PATTERNS, Stack, type Mode, type Pattern } from '#lib/sim/stack.svelte.js';
	import type { Saved, StackResult } from '#lib/server/results.js';
	import { fixed, when } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let runs = $derived(data.runs);

	const sim = new Stack();
	let view = $state(0);
	let speed = $derived(sim.config.speed);
	let rate = $derived(sim.config.rate);
	const locked = $derived(sim.status === 'running');
	const r = $derived(sim.results);

	async function save(s: Stack) {
		const saved = await saveRun<Saved<StackResult>[]>('/api/results/stack', {
			...s.config,
			stacked: s.stacked,
			missed: s.missed,
			blocked: s.blocked,
			time: s.time,
			throughput: s.results.throughput
		});
		if (saved) runs = saved;
	}
	sim.onComplete = (s) => void save(s);

	const patternName = (p: string) => PATTERNS.find((x) => x.id === p)?.name ?? p;
</script>

<svelte:head><title>Stack · Cellwork</title></svelte:head>

<SimShell cell="stack">
	{#snippet viewport()}<View {sim} {view} />{/snippet}
	{#snippet overlay()}
		<Overlay
			kicker={sim.conveyorRunning ? 'Conveyor running' : 'Conveyor stopped'}
			phase={sim.phase}
			time={sim.time}
			bind:view
		/>
	{/snippet}
	{#snippet panel()}
		<section class="space-y-3 border-b p-4">
			<RunControls
				status={sim.status}
				warp={sim.warp}
				onwarp={(w: number) => (sim.warp = w)}
				ontoggle={() => (sim.status === 'running' ? sim.pause() : sim.start())}
				onreset={() => sim.reset()}
				startLabel="Start line"
			/>
		</section>

		<Figures
			items={[
				{ label: 'On pallet', value: `${sim.stacked}/${sim.capacity}` },
				{ label: 'Throughput', value: fixed(r.throughput, 0), unit: 'billets/h' },
				{ label: 'Missed', value: String(sim.missed) },
				{ label: 'Furnace held', value: fixed(sim.blocked, 0), unit: 's' }
			]}
		/>

		<section class="space-y-2 border-b p-4">
			<div class="flex items-baseline justify-between">
				<span class="label">Robot busy</span>
				<span class="figures text-xs">{fixed(r.utilisation * 100, 0)} %</span>
			</div>
			<div class="h-1.5 bg-muted">
				<div class="h-full bg-primary" style="width: {(r.utilisation * 100).toFixed(1)}%"></div>
			</div>
		</section>

		<section class="space-y-5 border-b p-4">
			<div class="space-y-2">
				<div class="label">Picking</div>
				<Segmented
					label="Picking"
					options={[
						{ value: 'fly', label: 'On the fly' },
						{ value: 'stop', label: 'Stop and pick' }
					]}
					value={sim.config.mode}
					disabled={locked}
					onchange={(v: Mode) => sim.configure({ mode: v })}
				/>
				<p class="text-xs text-muted-foreground">
					{sim.config.mode === 'fly'
						? 'The arm plans an intercept and tracks each moving billet. Billets it can’t catch go to the reject bay.'
						: 'The conveyor halts each billet under the arm. Nothing is missed, but the furnace has to wait.'}
				</p>
			</div>
			<div class="space-y-2">
				<div class="label">Stack pattern</div>
				<Segmented
					label="Stack pattern"
					options={PATTERNS.map((p) => ({ value: p.id, label: p.name }))}
					value={sim.config.pattern}
					disabled={locked}
					onchange={(v: Pattern) => sim.configure({ pattern: v })}
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Arrivals</span>
					<span class="figures text-xs">{rate} per min</span>
				</div>
				<Slider
					type="single"
					bind:value={rate}
					min={3}
					max={14}
					step={1}
					disabled={locked}
					onValueCommit={(v: number) => sim.configure({ rate: v })}
					aria-label="Arrivals per minute"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Conveyor speed</span>
					<span class="figures text-xs">{fixed(speed, 2)} m/s</span>
				</div>
				<Slider
					type="single"
					bind:value={speed}
					min={0.1}
					max={0.5}
					step={0.05}
					disabled={locked}
					onValueCommit={(v: number) => sim.configure({ speed: v })}
					aria-label="Conveyor speed"
				/>
			</div>
			<div class="flex items-center justify-between">
				<span class="label">Arrival seed</span>
				<button
					type="button"
					class="flex items-center gap-1.5 border px-2 py-1 figures text-xs hover:bg-muted disabled:opacity-50"
					disabled={locked}
					onclick={() => sim.configure({ seed: Math.floor(Math.random() * 100000) })}
				>
					<Dices class="size-3.5" strokeWidth={1.5} />{sim.config.seed}
				</button>
			</div>
		</section>

		<section class="space-y-2 p-4">
			<h2 class="label">Recent runs</h2>
			{#if runs.length}
				<table class="w-full figures text-xs">
					<thead>
						<tr class="border-b text-left">
							<th class="py-1.5 label font-normal">When</th>
							<th class="py-1.5 label font-normal">Mode</th>
							<th class="py-1.5 text-right label font-normal">/min</th>
							<th class="py-1.5 text-right label font-normal">Per h</th>
							<th class="py-1.5 text-right label font-normal">Miss</th>
							<th class="py-1.5 text-right label font-normal">Held s</th>
						</tr>
					</thead>
					<tbody>
						{#each runs as run (run.id)}
							{@const s = run.summary}
							<tr class="border-b border-border/60" title={patternName(s.pattern)}>
								<td class="py-1 text-muted-foreground">{when(run.createdAt).slice(0, 5)}</td>
								<td class="py-1 font-sans">{s.mode === 'fly' ? 'Fly' : 'Stop'}</td>
								<td class="py-1 text-right">{s.rate}</td>
								<td class="py-1 text-right">{fixed(s.throughput, 0)}</td>
								<td class="py-1 text-right">{s.missed}</td>
								<td class="py-1 text-right">{fixed(s.blocked, 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="text-xs text-muted-foreground">Finished pallets are listed here.</p>
			{/if}
		</section>
	{/snippet}
	{#snippet below()}<SiteFooter />{/snippet}
</SimShell>
