<script lang="ts">
	import Dices from '@lucide/svelte/icons/dices';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { MOULDS, type MouldId } from '#lib/sim/cell.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { fixed } from '#lib/format.js';
	import Segmented from './Segmented.svelte';

	let { sim, locked }: { sim: Simulation; locked: boolean } = $props();

	// Sliders show their value live and only reset the run when released.
	let repeatability = $derived(sim.config.repeatability);
	let tolerance = $derived(sim.config.tolerance);
	let override = $derived(sim.config.override);

	const mouldNote = $derived(MOULDS.find((m) => m.id === sim.config.mould)?.note);
</script>

<div class="space-y-5">
	<div class="space-y-2">
		<div class="label">Mould</div>
		<Segmented
			options={MOULDS.map((m) => ({ value: m.id, label: m.name }))}
			value={sim.config.mould}
			disabled={locked}
			onchange={(v: MouldId) => sim.configure({ mould: v })}
			label="Mould"
		/>
		<p class="text-xs text-muted-foreground">{mouldNote}.</p>
	</div>

	<div class="space-y-2">
		<div class="label">Ply stations along the span</div>
		<Segmented
			options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
			value={sim.config.stations}
			disabled={locked}
			onchange={(v: number) => sim.configure({ stations: v })}
			label="Stations"
		/>
	</div>

	<label class="flex items-start justify-between gap-4">
		<span class="space-y-1">
			<span class="block text-sm font-medium">Vision-guided pick</span>
			<span class="block text-xs text-muted-foreground">
				The kit camera measures where each ply really lies, and the arm corrects its pick to match.
				Off, the arm picks at the nominal slot and the kitting error is carried onto the mould.
			</span>
		</span>
		<Switch
			checked={sim.config.vision}
			disabled={locked}
			onCheckedChange={(v: boolean) => sim.configure({ vision: v })}
			class="mt-1"
		/>
	</label>

	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<span class="label">Placement repeatability</span>
			<span class="figures text-xs">σ {fixed(repeatability, 1)} mm</span>
		</div>
		<Slider
			type="single"
			bind:value={repeatability}
			min={0.1}
			max={3}
			step={0.1}
			disabled={locked}
			onValueCommit={(v: number) => sim.configure({ repeatability: v })}
			aria-label="Placement repeatability"
		/>
	</div>

	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<span class="label">Inspection tolerance</span>
			<span class="figures text-xs">± {fixed(tolerance, 1)} mm</span>
		</div>
		<Slider
			type="single"
			bind:value={tolerance}
			min={0.5}
			max={5}
			step={0.5}
			disabled={locked}
			onValueCommit={(v: number) => sim.configure({ tolerance: v })}
			aria-label="Inspection tolerance"
		/>
	</div>

	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<span class="label">Speed override</span>
			<span class="figures text-xs">{override} %</span>
		</div>
		<Slider
			type="single"
			bind:value={override}
			min={20}
			max={100}
			step={5}
			disabled={locked}
			onValueCommit={(v: number) => sim.configure({ override: v })}
			aria-label="Speed override"
		/>
	</div>

	<div class="flex items-center justify-between gap-4">
		<span class="space-y-1">
			<span class="block label">Disturbance seed</span>
			<span class="block text-xs text-muted-foreground">
				Same seed, same kitting errors, so settings can be compared fairly.
			</span>
		</span>
		<button
			type="button"
			class="flex items-center gap-1.5 border px-2 py-1 figures text-xs hover:bg-muted disabled:opacity-50"
			disabled={locked}
			onclick={() => sim.configure({ seed: Math.floor(Math.random() * 100000) })}
			title="Draw a new seed"
		>
			<Dices class="size-3.5" strokeWidth={1.5} />
			{sim.config.seed}
		</button>
	</div>
</div>
