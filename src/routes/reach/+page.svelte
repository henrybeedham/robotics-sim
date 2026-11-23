<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import Undo from '@lucide/svelte/icons/undo-2';
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
	import View from '#lib/scene/reach/View.svelte';
	import { BOX, PRESETS, Reach, SNAKE, bayOf } from '#lib/sim/reach.svelte.js';
	import { fixed } from '#lib/format.js';

	const sim = new Reach();
	let view = $state(0);
	let showTop = $state(true);
	let limit = $derived(sim.bendLimit);

	const moving = $derived(sim.status === 'advancing' || sim.status === 'retracting');
	const phase = $derived(
		{ stowed: 'Stowed', advancing: 'Advancing', retracting: 'Backing out', arrived: 'On station' }[
			sim.status
		]
	);
	const inside = $derived(sim.readout.joints.filter((j) => j.x > BOX.x0).length);
	const worstNow = $derived(Math.max(0, ...sim.readout.bends));
	const preset = $derived(
		PRESETS.findIndex((p) => p.target.x === sim.target.x && p.target.y === sim.target.y)
	);
</script>

<svelte:head><title>Reach · Cellwork</title></svelte:head>

<SimShell cell="reach">
	{#snippet viewport()}<View {sim} {view} {showTop} />{/snippet}
	{#snippet overlay()}
		<Overlay kicker="Snake arm · {SNAKE.links} links" {phase} bind:view />
	{/snippet}
	{#snippet panel()}
		<section class="space-y-3 border-b p-4">
			<div class="label">Work point</div>
			<div class="flex flex-wrap gap-1.5">
				{#each PRESETS as p, i (p.name)}
					<button
						type="button"
						disabled={moving}
						onclick={() => sim.aim(p.target)}
						class="border px-2 py-1 text-xs transition-colors duration-150 disabled:opacity-50 {preset ===
						i
							? 'bg-foreground text-background'
							: 'hover:bg-muted'}"
					>
						{p.name}
					</button>
				{/each}
			</div>
			<PlanMap {sim} locked={moving} />
			<div class="flex flex-wrap items-center gap-2">
				<Button
					onclick={() => sim.go()}
					disabled={moving ||
						!!sim.plan.problem ||
						(sim.status === 'arrived' && sim.active === sim.plan.path)}
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
			<p class="text-xs {sim.plan.problem ? 'text-destructive' : 'text-muted-foreground'}">
				{sim.plan.problem ?? `Bay ${bayOf(sim.target.x) + 1}. Route clears every rib hole.`}
			</p>
		</section>

		<Figures
			items={[
				{ label: 'Route', value: fixed(sim.plan.path.length, 2), unit: 'm' },
				{ label: 'Links inside', value: `${inside}/${SNAKE.links}` },
				{ label: 'Worst bend', value: fixed(sim.plan.maxBend, 1), unit: `° / ${sim.bendLimit}°` },
				{ label: 'Tightest gap', value: fixed(sim.plan.minClearance, 0), unit: 'mm' }
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
					max={40}
					step={1}
					disabled={moving}
					onValueCommit={(v: number) => sim.setBendLimit(v)}
					aria-label="Joint bend limit"
				/>
			</div>
			<label class="flex items-center justify-between gap-4 text-sm">
				Show upper skin
				<Switch bind:checked={showTop} />
			</label>
		</section>
	{/snippet}
	{#snippet below()}<SiteFooter />{/snippet}
</SimShell>
