<script lang="ts">
	import { onMount } from 'svelte';
	import Send from '@lucide/svelte/icons/send';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Dices from '@lucide/svelte/icons/dices';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import Segmented from '#lib/components/drape/Segmented.svelte';
	import SimShell from '#lib/components/site/SimShell.svelte';
	import Overlay from '#lib/components/site/Overlay.svelte';
	import Figures from '#lib/components/site/Figures.svelte';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import PlanMap from '#lib/components/reach/PlanMap.svelte';
	import BendChart from '#lib/components/reach/BendChart.svelte';
	import DrivePad from '#lib/components/reach/DrivePad.svelte';
	import View from '#lib/scene/reach/View.svelte';
	import { LEVELS, Reach } from '#lib/sim/reach.svelte.js';
	import { fixed } from '#lib/format.js';

	const sim = new Reach();
	const names = LEVELS.map((make) => make());
	let view = $state(0);
	let seeThrough = $state(true);
	let limit = $derived(sim.bendLimit);
	let ready = $state(false);

	// Planning runs in the browser only.
	onMount(() => {
		sim.setLevel(0);
		ready = true;
	});

	const moving = $derived(sim.status === 'advancing' || sim.status === 'retracting');
	const phase = $derived(
		{
			stowed: 'Stowed',
			advancing: 'Advancing',
			retracting: 'Backing out',
			arrived: 'On station',
			driving: 'Driving by hand'
		}[sim.status]
	);
	const inside = $derived(sim.readout.joints.filter((j) => j.x > 0).length);
	const worstNow = $derived(Math.max(0, ...sim.readout.bends));
	const tipGap = $derived(sim.readout.clearance[0] ?? 0);
	const arrived = $derived(sim.status === 'arrived' && sim.active === sim.plan?.path);

	function choose(i: number) {
		if (moving) return;
		sim.setLevel(i);
		view = 0;
	}
</script>

<svelte:head><title>Reach · Cellwork</title></svelte:head>

<SimShell cell="reach">
	{#snippet viewport()}<View {sim} {view} {seeThrough} />{/snippet}
	{#snippet overlay()}
		<Overlay
			kicker="{sim.level.name} · {sim.links} links of {sim.level.link * 1000} mm"
			{phase}
			views={['Overview', 'Plan', 'Side', 'Tip camera']}
			bind:view
		/>
		{#if view === 3}
			<!-- Tip camera HUD -->
			<div class="pointer-events-none absolute inset-0 grid place-items-center">
				<svg
					width="44"
					height="44"
					viewBox="-22 -22 44 44"
					class="stroke-white/80"
					aria-hidden="true"
				>
					<circle r="12" fill="none" stroke-width="1" />
					<line x1="-22" x2="-14" y1="0" y2="0" stroke-width="1" />
					<line x1="14" x2="22" y1="0" y2="0" stroke-width="1" />
					<line y1="-22" y2="-14" x1="0" x2="0" stroke-width="1" />
					<line y1="14" y2="22" x1="0" x2="0" stroke-width="1" />
				</svg>
			</div>
			<div
				class="pointer-events-none absolute top-16 left-3 space-y-0.5 bg-black/55 px-2 py-1.5 figures text-[11px] text-white"
			>
				<div>gap {fixed(tipGap, 0)} mm</div>
				<div>bend {fixed(sim.readout.bends[0] ?? 0, 1)}°</div>
				<div>{inside}/{sim.links} links in</div>
				<div class="pt-1 opacity-70">W A S D · Q E to drive</div>
			</div>
		{/if}
	{/snippet}
	{#snippet panel()}
		<section class="space-y-2 border-b p-4">
			<div class="label">Structure</div>
			<ol class="space-y-1">
				{#each names as lv, i (lv.id)}
					<li>
						<button
							type="button"
							disabled={moving}
							onclick={() => choose(i)}
							class="flex w-full items-baseline gap-3 border px-2.5 py-1.5 text-left text-sm transition-colors duration-150 disabled:opacity-50 {sim.levelIndex ===
							i
								? 'border-foreground bg-foreground text-background'
								: 'hover:bg-muted'}"
						>
							<span
								class="figures text-[10px] tracking-widest"
								aria-label="Difficulty {lv.difficulty} of 5"
							>
								{'●'.repeat(lv.difficulty)}<span class="opacity-30">
									{'●'.repeat(5 - lv.difficulty)}
								</span>
							</span>
							<span class="font-medium">{lv.name}</span>
							<span class="ml-auto hidden text-xs opacity-70 sm:inline">{lv.blurb}</span>
						</button>
					</li>
				{/each}
			</ol>
			{#if sim.level.seed !== null}
				<button
					type="button"
					disabled={moving}
					onclick={() => sim.setLevel(sim.levelIndex, Math.floor(Math.random() * 100000))}
					class="flex items-center gap-1.5 border px-2 py-1 figures text-xs hover:bg-muted disabled:opacity-50"
				>
					<Dices class="size-3.5" strokeWidth={1.5} /> New maze · seed {sim.level.seed}
				</button>
			{/if}
		</section>

		<section class="space-y-3 border-b p-4">
			<div class="label">Work point</div>
			<div class="flex flex-wrap gap-1.5">
				{#each sim.level.targets as t, i (t.name)}
					<button
						type="button"
						disabled={moving || !ready}
						onclick={() => sim.aim(i)}
						class="border px-2 py-1 text-xs transition-colors duration-150 disabled:opacity-50 {sim.target ===
						i
							? 'bg-foreground text-background'
							: 'hover:bg-muted'}"
					>
						{t.name}
					</button>
				{/each}
			</div>
			{#if ready}<PlanMap {sim} locked={moving} />{/if}
			<div class="flex flex-wrap items-center gap-2">
				<Button
					onclick={() => sim.go()}
					disabled={moving || !sim.plan?.path || !!sim.plan?.problem || arrived}
				>
					<Send strokeWidth={1.5} /> Send arm
				</Button>
				<Button
					variant="outline"
					onclick={() => sim.retract()}
					disabled={sim.status === 'stowed' || sim.status === 'retracting'}
				>
					<Undo strokeWidth={1.5} /> Retract
				</Button>
				<div class="ml-auto">
					<Segmented
						label="Speed"
						options={[1, 2, 4].map((w) => ({ value: w, label: `${w}×` }))}
						value={sim.speed}
						onchange={(w: number) => (sim.speed = w)}
					/>
				</div>
			</div>
			<p class="text-xs {sim.plan?.problem ? 'text-destructive' : 'text-muted-foreground'}">
				{#if !sim.plan}Planning…{:else}{sim.plan.problem ??
						'Route found. Every joint stays inside its limit.'}{/if}
			</p>
		</section>

		<section class="space-y-3 border-b p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="label">Drive it yourself</h2>
				{#if sim.status === 'driving'}<span class="text-xs text-primary">Manual</span>{/if}
			</div>
			<DrivePad {sim} />
			{#if sim.blocked}<p class="text-xs text-destructive">{sim.blocked}</p>{/if}
		</section>

		<Figures
			items={[
				{
					label: 'Route',
					value: fixed(sim.plan?.path?.length, 2),
					unit: `m / ${fixed(sim.links * sim.level.link, 1)} m`
				},
				{ label: 'Links inside', value: `${inside}/${sim.links}` },
				{ label: 'Worst bend', value: fixed(sim.plan?.maxBend, 1), unit: `° / ${sim.bendLimit}°` },
				{ label: 'Tightest gap', value: fixed(sim.plan?.minClearance, 0), unit: 'mm' }
			]}
		/>

		<section class="space-y-2 border-b p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="label">Bend per joint, now</h2>
				<span class="figures text-xs text-muted-foreground">max {fixed(worstNow, 1)}°</span>
			</div>
			<BendChart bends={sim.readout.bends} {limit} />
		</section>

		<section class="space-y-4 p-4">
			<div class="space-y-2">
				<div class="flex items-baseline justify-between">
					<span class="label">Joint bend limit</span>
					<span class="figures text-xs">{limit}°</span>
				</div>
				<Slider
					type="single"
					bind:value={limit}
					min={12}
					max={60}
					step={1}
					disabled={moving}
					onValueCommit={(v: number) => sim.setBendLimit(v)}
					aria-label="Joint bend limit"
				/>
			</div>
			<label class="flex items-center justify-between gap-4 text-sm">
				See through the outer skin
				<Switch bind:checked={seeThrough} />
			</label>
		</section>
	{/snippet}
	{#snippet below()}<SiteFooter />{/snippet}
</SimShell>
