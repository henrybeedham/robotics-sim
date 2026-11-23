<script lang="ts">
	import { LIMITS, RAIL } from '#lib/sim/robot.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';

	let { sim }: { sim: Simulation } = $props();

	const r2d = 180 / Math.PI;
	const rows = $derived([
		...sim.readout.q.map((v, i) => ({
			name: `J${i + 1}`,
			value: v * r2d,
			unit: '°',
			min: LIMITS[i][0] * r2d,
			max: LIMITS[i][1] * r2d
		})),
		{
			name: 'E1',
			value: sim.readout.rail * 1000,
			unit: 'mm',
			min: RAIL.min * 1000,
			max: RAIL.max * 1000
		}
	]);
	const tcp = $derived(sim.readout.tcp.map((v) => (v * 1000).toFixed(0)));
</script>

<div class="space-y-3">
	<table class="w-full figures text-xs">
		<tbody>
			{#each rows as r (r.name)}
				{@const pos = (r.value - r.min) / (r.max - r.min)}
				<tr>
					<td class="w-8 py-0.5 text-muted-foreground">{r.name}</td>
					<td class="w-20 py-0.5 pr-3 text-right">
						{r.value.toFixed(r.unit === '°' ? 1 : 0)}
						{r.unit}
					</td>
					<td class="py-0.5">
						<div
							class="relative h-2 border-x border-foreground/40"
							title="{r.min.toFixed(0)} to {r.max.toFixed(0)} {r.unit}"
						>
							<div class="absolute inset-x-0 top-1/2 h-px bg-border"></div>
							<div
								class="absolute top-0 h-2 w-0.5 bg-primary"
								style="left: calc({(pos * 100).toFixed(2)}% - 1px)"
							></div>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="figures text-xs text-muted-foreground">
		TCP x {tcp[0]} · y {tcp[1]} · z {tcp[2]} mm
	</p>
</div>
