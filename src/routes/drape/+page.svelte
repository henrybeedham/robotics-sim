<script lang="ts">
	import { browser } from '$app/env';
	import { toast } from 'svelte-sonner';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Simulation } from '#lib/sim/engine.svelte.js';
	import { MOULDS, PLY_MASS } from '#lib/sim/cell.js';
	import { angleLabel, clock, fixed, when } from '#lib/format.js';
	import View from '#lib/scene/drape/View.svelte';
	import Segmented from '#lib/components/drape/Segmented.svelte';
	import Settings from '#lib/components/drape/Settings.svelte';
	import PlyBook from '#lib/components/drape/PlyBook.svelte';
	import InspectionChart from '#lib/components/drape/InspectionChart.svelte';
	import Telemetry from '#lib/components/drape/Telemetry.svelte';
	import type { PageProps } from './$types';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import type { RunSummary } from '#lib/server/runs.js';

	let { data }: PageProps = $props();

	const sim = new Simulation();
	// Starts from the server, then replaced by the list returned after each save.
	let runs = $derived(data.runs);
	let view = $state(0);

	const locked = $derived(sim.status === 'running');
	const results = $derived(sim.results);
	const mouldName = (id: string) => MOULDS.find((m) => m.id === id)?.name ?? id;

	async function save(s: Simulation) {
		const r = s.results;
		const body = {
			...s.config,
			plies: s.plies.length,
			passed: r.passed,
			meanCycle: r.meanCycle ?? 0,
			rate: r.rate ?? 0,
			meanDeviation: r.meanDeviation ?? 0,
			maxDeviation: r.maxDeviation ?? 0
		};
		try {
			const res = await fetch('/api/runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const problem = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(problem?.message ?? res.statusText);
			}
			runs = ((await res.json()) as { runs: RunSummary[] }).runs;
			toast.success('Run complete. Results added to the table below.');
		} catch (e) {
			toast.error(`Run complete, but it could not be saved: ${(e as Error).message}`);
		}
	}
	sim.onComplete = (s) => void save(s);

	function toggleRun() {
		if (sim.status === 'running') sim.pause();
		else sim.start();
	}

	const runLabel = $derived(
		sim.status === 'running'
			? 'Pause'
			: sim.status === 'paused'
				? 'Resume'
				: sim.status === 'done'
					? 'Run again'
					: 'Start layup'
	);
	const placed = $derived(
		sim.plies.filter((p) => p.status === 'placed' || p.status === 'inspected').length
	);
</script>

<svelte:head>
	<title>Drape · Cellwork</title>
</svelte:head>

<SiteHeader current="drape" />

<main class="lg:grid lg:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_400px]">
	<!-- 3D cell -->
	<section
		class="relative h-[58dvh] min-h-80 border-b lg:h-full lg:border-r lg:border-b-0"
		style="background: var(--scene-bg)"
		aria-label="3D view of the cell"
	>
		{#if browser}
			<View {sim} {view} />
		{/if}
		<div
			class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-3"
		>
			<div>
				<div class="label">
					{sim.current >= 0 ? `Ply ${sim.current + 1} of ${sim.plies.length}` : 'Cell'}
				</div>
				<div class="font-display text-lg leading-tight font-medium">{sim.phase}</div>
			</div>
			<div class="text-right">
				<div class="label">Cell time</div>
				<div class="figures text-lg leading-tight">{clock(sim.time)}</div>
			</div>
		</div>
		<div class="absolute bottom-3 left-3 flex items-center gap-2">
			<Segmented
				size="sm"
				label="Camera view"
				options={[
					{ value: 0, label: 'Overview' },
					{ value: 1, label: 'Plan' },
					{ value: 2, label: 'Kit side' }
				]}
				value={view}
				onchange={(v: number) => (view = v)}
			/>
		</div>
		<p
			class="pointer-events-none absolute right-3 bottom-3 hidden text-[11px] text-muted-foreground sm:block"
		>
			Drag to orbit, scroll to zoom
		</p>
	</section>

	<!-- Process sheet -->
	<aside class="lg:overflow-y-auto">
		<section class="space-y-3 border-b p-4">
			<div class="flex flex-wrap items-center gap-2">
				<Button onclick={toggleRun} disabled={sim.status === 'error'} class="min-w-28">
					{#if sim.status === 'running'}<Pause strokeWidth={1.5} />{:else}<Play
							strokeWidth={1.5}
						/>{/if}
					{runLabel}
				</Button>
				<Button variant="outline" onclick={() => sim.reset()} disabled={sim.status === 'idle'}>
					<RotateCcw strokeWidth={1.5} /> Reset
				</Button>
				<div class="ml-auto">
					<Segmented
						label="Playback speed"
						options={[1, 2, 4, 8].map((w) => ({ value: w, label: `${w}×` }))}
						value={sim.warp}
						onchange={(w: number) => (sim.warp = w)}
					/>
				</div>
			</div>
			{#if sim.error}
				<p class="text-xs text-destructive">{sim.error} Try fewer stations or a different mould.</p>
			{:else if locked}
				<p class="text-xs text-muted-foreground">
					Settings are locked while the cell runs. Pause to change them; any change restarts the
					layup.
				</p>
			{/if}
		</section>

		<section class="grid grid-cols-2 border-b" aria-label="Run results">
			{#each [{ label: 'Mean cycle', value: fixed(results.meanCycle, 1), unit: 's' }, { label: 'Deposition', value: fixed(results.rate, 1), unit: 'kg/h' }, { label: 'In tolerance', value: results.inspected ? `${results.passed}/${results.inspected}` : '—', unit: '' }, { label: 'Worst corner', value: fixed(results.maxDeviation, 2), unit: 'mm' }] as f, i (f.label)}
				<div class="space-y-0.5 px-4 py-3 {i % 2 ? 'border-l' : ''} {i > 1 ? 'border-t' : ''}">
					<div class="label">{f.label}</div>
					<div class="figures text-2xl leading-none">
						{f.value}<span class="ml-1 text-xs text-muted-foreground">{f.unit}</span>
					</div>
				</div>
			{/each}
		</section>

		<section class="space-y-3 border-b p-4">
			<h2 class="label">Inspection</h2>
			<InspectionChart {sim} />
		</section>

		<section class="space-y-3 border-b p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="label">Ply book</h2>
				<span class="figures text-xs text-muted-foreground">
					{placed}/{sim.plies.length} laid · {fixed(placed * PLY_MASS, 2)} kg
				</span>
			</div>
			<PlyBook {sim} {locked} />
		</section>

		<section class="space-y-3 border-b p-4">
			<h2 class="label">Cell settings</h2>
			<Settings {sim} {locked} />
		</section>

		<section class="space-y-3 p-4">
			<h2 class="label">Axes</h2>
			<Telemetry {sim} />
		</section>
	</aside>
</main>

<div class="border-t">
	<section
		id="how"
		class="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[16rem_minmax(0,1fr)]"
	>
		<div>
			<h2 class="font-display text-3xl font-semibold tracking-tight">How the cell works</h2>
			<p class="mt-3 text-sm text-muted-foreground">
				Laying dry carbon fabric by hand is slow and hard to repeat. This cell automates the step
				that makes a preform: taking flat, cut plies and draping them onto a curved tool in the
				right order, angle and place.
			</p>
		</div>
		<ol class="grid gap-x-10 gap-y-8 text-sm sm:grid-cols-2">
			<li class="border-t pt-3">
				<div class="mb-1 label">01 · Kit</div>
				A feeder lays each cut ply on the kitting table, never quite where it should be: up to 6 mm and
				1.2° out. The kit camera measures the real pose and the pick is corrected to match.
			</li>
			<li class="border-t pt-3">
				<div class="mb-1 label">02 · Pick</div>
				The arm descends in a straight line under Cartesian control, switches on 18 vacuum cups and lifts.
				The next ply is presented as soon as the table is clear.
			</li>
			<li class="border-t pt-3">
				<div class="mb-1 label">03 · Conform</div>
				During the transfer, each cup’s actuator moves to the height of the mould surface below it, taken
				straight from the tool geometry. The flat ply bends to the mould’s shape before it touches, so
				it lands without wrinkling or sliding.
			</li>
			<li class="border-t pt-3">
				<div class="mb-1 label">04 · Drape and tack</div>
				The gripper lowers along the surface normal, heats the binder to tack the ply to the one below,
				releases and retracts. Plies are laid layer by layer, so every station gets its 0° before any
				gets its 45°.
			</li>
			<li class="border-t pt-3">
				<div class="mb-1 label">05 · Inspect</div>
				A laser line sweeps each ply as the arm leaves, and the worst corner’s deviation is compared to
				the tolerance. Failed plies are marked on the tool and in the ply book.
			</li>
			<li class="border-t pt-3">
				<div class="mb-1 label">Under the hood</div>
				The arm uses closed-form inverse kinematics for a six-axis robot with a spherical wrist, on a
				linear seventh axis. Joint moves use quintic profiles timed to each joint’s speed limit. Disturbances
				come from a seeded generator, so a run can be repeated exactly.
			</li>
		</ol>
	</section>

	<section class="mx-auto max-w-6xl px-4 pb-14">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-6">
			<h2 class="font-display text-2xl font-semibold tracking-tight">Recent runs</h2>
			<p class="text-xs text-muted-foreground">
				Try the same seed with vision on and off, or at different speed overrides, and compare.
			</p>
		</div>
		{#if runs.length}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[46rem] text-xs">
					<thead>
						<tr class="border-b text-left">
							<th class="py-2 pr-3 label font-normal">When</th>
							<th class="py-2 pr-3 label font-normal">Mould</th>
							<th class="py-2 pr-3 label font-normal">Stack</th>
							<th class="py-2 pr-3 label font-normal">Vision</th>
							<th class="py-2 pr-3 text-right label font-normal">σ mm</th>
							<th class="py-2 pr-3 text-right label font-normal">Override</th>
							<th class="py-2 pr-3 text-right label font-normal">Cycle s</th>
							<th class="py-2 pr-3 text-right label font-normal">kg/h</th>
							<th class="py-2 pr-3 text-right label font-normal">In tol.</th>
							<th class="py-2 text-right label font-normal">Worst mm</th>
						</tr>
					</thead>
					<tbody class="figures">
						{#each runs as r (r.id)}
							<tr class="border-b border-border/60">
								<td class="py-1.5 pr-3 text-muted-foreground">{when(r.createdAt)}</td>
								<td class="py-1.5 pr-3 font-sans">{mouldName(r.mould)}</td>
								<td class="py-1.5 pr-3">
									[{r.layers.map(angleLabel).join('/')}]{r.stations > 1 ? ` ×${r.stations}` : ''}
								</td>
								<td class="py-1.5 pr-3 font-sans">{r.vision ? 'On' : 'Off'}</td>
								<td class="py-1.5 pr-3 text-right">{fixed(r.repeatability, 1)}</td>
								<td class="py-1.5 pr-3 text-right">{r.override} %</td>
								<td class="py-1.5 pr-3 text-right">{fixed(r.meanCycle, 1)}</td>
								<td class="py-1.5 pr-3 text-right">{fixed(r.rate, 1)}</td>
								<td class="py-1.5 pr-3 text-right {r.passed < r.plies ? 'text-destructive' : ''}">
									{r.passed}/{r.plies}
								</td>
								<td class="py-1.5 text-right">{fixed(r.maxDeviation, 2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="border-y py-6 text-sm text-muted-foreground">
				Finished layups are listed here. Press <span class="text-foreground">Start layup</span> above
				to run the first one.
			</p>
		{/if}
	</section>

	<SiteFooter />
</div>
