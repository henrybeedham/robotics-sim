<script lang="ts">
	import Dices from '@lucide/svelte/icons/dices';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import Segmented from '#lib/components/drape/Segmented.svelte';
	import SimShell from '#lib/components/site/SimShell.svelte';
	import Overlay from '#lib/components/site/Overlay.svelte';
	import Figures from '#lib/components/site/Figures.svelte';
	import RunControls from '#lib/components/site/RunControls.svelte';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import Timeline from '#lib/components/tandem/Timeline.svelte';
	import { saveRun } from '#lib/components/site/save.js';
	import View from '#lib/scene/tandem/View.svelte';
	import { STRATEGIES, Tandem, type Strategy } from '#lib/sim/tandem.svelte.js';
	import type { Saved, TandemResult } from '#lib/server/results.js';
	import { clock, fixed, when } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let runs = $derived(data.runs);

	const sim = new Tandem();
	let view = $state(0);
	let layers = $derived(sim.config.layers);
	let perLayer = $derived(sim.config.perLayer);
	let speed = $derived(sim.config.speed);
	const locked = $derived(sim.status === 'running');
	const r = $derived(sim.results);
	const expected = $derived(sim.compare[sim.config.strategy]);
	const speedup = $derived(expected > 0 ? sim.compare.single / expected : 0);
	const laid = $derived(sim.plies.filter((p) => p.state === 'placed').length);
	const worst = $derived(Math.max(...Object.values(sim.compare)));
	const lanes = $derived(sim.config.strategy === 'single' ? [0] : [0, 1]);
	const doing: Record<string, string> = {
		move: 'travelling',
		pick: 'picking',
		place: 'placing',
		zone: 'waiting for rail',
		layer: 'waiting for layer',
		idle: 'idle'
	};
	const phase = $derived(
		sim.status === 'done'
			? 'Layup complete'
			: lanes.map((g) => `${g === 0 ? 'A' : 'B'} ${doing[sim.activity[g]]}`).join(' · ')
	);

	async function save(t: Tandem) {
		const saved = await saveRun<Saved<TandemResult>[]>('/api/results/tandem', {
			...t.config,
			time: t.time,
			rate: t.results.rate,
			speedup: t.compare.single / t.time,
			waitZone: t.results.waitZone,
			waitLayer: t.results.waitLayer
		});
		if (saved) runs = saved;
	}
	sim.onComplete = (t) => void save(t);
	const strategyName = (s: string) => STRATEGIES.find((x) => x.id === s)?.name ?? s;
</script>

<svelte:head><title>Tandem · Cellwork</title></svelte:head>

<SimShell cell="tandem">
	{#snippet viewport()}<View {sim} {view} />{/snippet}
	{#snippet overlay()}
		<Overlay
			kicker="Layer {sim.layer + 1} of {sim.config.layers}"
			{phase}
			time={sim.time}
			bind:view
		/>
	{/snippet}
	{#snippet panel()}
		<section class="border-b p-4">
			<RunControls
				status={sim.status}
				warp={sim.warp}
				warps={[2, 4, 8, 16]}
				onwarp={(w: number) => (sim.warp = w)}
				ontoggle={() => (sim.status === 'running' ? sim.pause() : sim.start())}
				onreset={() => sim.reset()}
				startLabel="Start layup"
			/>
		</section>

		<Figures
			items={[
				{ label: 'Plies laid', value: `${laid}/${sim.plies.length}` },
				{ label: 'Deposition', value: fixed(r.rate, 1), unit: 'kg/h' },
				{
					label: 'Vs one gantry',
					value: sim.config.strategy === 'single' ? '—' : `×${fixed(speedup, 2)}`
				},
				{ label: 'Time waiting', value: fixed(r.waitZone + r.waitLayer, 0), unit: 's' }
			]}
		/>

		<section class="space-y-3 border-b p-4">
			<h2 class="label">Timeline</h2>
			<Timeline spans={sim.timeline} now={sim.time} end={expected} {lanes} />
		</section>

		<section class="space-y-2 border-b p-4">
			<h2 class="label">Whole layup, by strategy</h2>
			<dl class="space-y-1.5 text-xs">
				{#each STRATEGIES as s (s.id)}
					{@const t = sim.compare[s.id]}
					<div class="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
						<dt class={s.id === sim.config.strategy ? 'font-medium' : 'text-muted-foreground'}>
							{s.name}
						</dt>
						<div class="h-2.5 bg-muted">
							<div
								class="h-full {s.id === sim.config.strategy ? 'bg-primary' : 'bg-foreground/40'}"
								style="width: {((t / worst) * 100).toFixed(1)}%"
							></div>
						</div>
						<dd class="text-right figures">{clock(t).slice(0, 5)}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="space-y-5 border-b p-4">
			<div class="space-y-2">
				<div class="label">Scheduling</div>
				<Segmented
					label="Scheduling"
					options={STRATEGIES.map((s) => ({ value: s.id, label: s.name }))}
					value={sim.config.strategy}
					disabled={locked}
					onchange={(v: Strategy) => sim.configure({ strategy: v })}
				/>
				<p class="text-xs text-muted-foreground">
					{{
						single: 'Gantry A lays every ply; B stays parked.',
						zones:
							'A takes the left half of the tool, B the right. Simple, but one can sit idle when its half is done.',
						shared:
							'Both draw from one queue, each taking the ply nearest its kit, and reserve rail before moving.'
					}[sim.config.strategy]}
				</p>
			</div>
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Layers</span><span class="figures text-xs">{layers}</span>
				</div>
				<Slider
					type="single"
					bind:value={layers}
					min={1}
					max={6}
					step={1}
					disabled={locked}
					onValueCommit={(v: number) => sim.configure({ layers: v })}
					aria-label="Layers"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Plies per layer</span><span class="figures text-xs">{perLayer}</span>
				</div>
				<Slider
					type="single"
					bind:value={perLayer}
					min={4}
					max={14}
					step={1}
					disabled={locked}
					onValueCommit={(v: number) => sim.configure({ perLayer: v })}
					aria-label="Plies per layer"
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Bridge speed</span><span class="figures text-xs">
						{fixed(speed, 1)} m/s
					</span>
				</div>
				<Slider
					type="single"
					bind:value={speed}
					min={0.4}
					max={2.4}
					step={0.2}
					disabled={locked}
					onValueCommit={(v: number) => sim.configure({ speed: v })}
					aria-label="Bridge speed"
				/>
			</div>
			<div class="flex items-center justify-between">
				<span class="label">Ply book seed</span>
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
							<th class="py-1.5 label font-normal">Scheduling</th>
							<th class="py-1.5 text-right label font-normal">Plies</th>
							<th class="py-1.5 text-right label font-normal">Time</th>
							<th class="py-1.5 text-right label font-normal">Speed-up</th>
						</tr>
					</thead>
					<tbody>
						{#each runs as run (run.id)}
							{@const s = run.summary}
							<tr class="border-b border-border/60">
								<td class="py-1 text-muted-foreground">{when(run.createdAt).slice(0, 5)}</td>
								<td class="py-1 font-sans">{strategyName(s.strategy)}</td>
								<td class="py-1 text-right">{s.layers * s.perLayer}</td>
								<td class="py-1 text-right">{clock(s.time).slice(0, 5)}</td>
								<td class="py-1 text-right">×{fixed(s.speedup, 2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="text-xs text-muted-foreground">Finished layups are listed here.</p>
			{/if}
		</section>
	{/snippet}
	{#snippet below()}<SiteFooter />{/snippet}
</SimShell>
