<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { ANGLES, type Angle, type Simulation } from '#lib/sim/engine.svelte.js';
	import { angleLabel, fixed, laminate } from '#lib/format.js';
	import AngleGlyph from './AngleGlyph.svelte';

	let { sim, locked }: { sim: Simulation; locked: boolean } = $props();

	const layers = $derived(sim.config.layers);
	const checks = $derived(laminate(layers));

	function cycle(i: number) {
		const next = ANGLES[(ANGLES.indexOf(layers[i]) + 1) % ANGLES.length];
		sim.configure({ layers: layers.map<Angle>((a, j) => (j === i ? next : a)) });
	}
	function add() {
		if (layers.length < 16) sim.configure({ layers: [...layers, 0] });
	}
	function remove(i: number) {
		if (layers.length > 1) sim.configure({ layers: layers.filter((_, j) => j !== i) });
	}

	const statusText = {
		queued: 'Queued',
		kitted: 'On kit',
		carried: 'In gripper',
		placed: 'Scanning',
		inspected: ''
	};
</script>

<div class="space-y-3">
	<div
		class="flex flex-wrap items-center gap-1.5"
		role="group"
		aria-label="Layer stacking sequence"
	>
		{#each layers as angle, i (i)}
			<div class="group flex items-stretch border bg-card">
				<button
					type="button"
					class="flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
					disabled={locked}
					onclick={() => cycle(i)}
					title="Layer {i + 1}: change angle"
				>
					<span class="figures text-[10px] text-muted-foreground">{i + 1}</span>
					<AngleGlyph {angle} size={12} />
					<span class="w-7 text-left figures">{angleLabel(angle)}</span>
				</button>
				{#if !locked && layers.length > 1}
					<button
						type="button"
						class="border-l px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						onclick={() => remove(i)}
						aria-label="Remove layer {i + 1}"
					>
						<X class="size-3" strokeWidth={1.5} />
					</button>
				{/if}
			</div>
		{/each}
		<button
			type="button"
			class="flex items-center gap-1 border border-dashed px-2 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
			disabled={locked || layers.length >= 16}
			onclick={add}
		>
			<Plus class="size-3" strokeWidth={1.5} /> Layer
		</button>
	</div>
	<p class="text-xs text-muted-foreground">
		Click a layer to change its angle.
		<span class={checks.balanced ? 'text-foreground' : ''}>
			{checks.balanced ? 'Balanced' : 'Not balanced'}
		</span>,
		<span class={checks.symmetric ? 'text-foreground' : ''}>
			{checks.symmetric ? 'symmetric' : 'not symmetric'}
		</span>. A balanced, symmetric stack cures flat without twisting.
	</p>

	<div class="max-h-72 overflow-y-auto border-y">
		<table class="w-full text-xs">
			<thead class="sticky top-0 bg-background">
				<tr class="border-b text-left">
					<th class="py-1.5 pr-2 label font-normal">Ply</th>
					<th class="py-1.5 pr-2 label font-normal">Layer</th>
					<th class="py-1.5 pr-2 label font-normal">Stn</th>
					<th class="py-1.5 pr-2 label font-normal">Angle</th>
					<th class="py-1.5 pr-2 text-right label font-normal">Cycle s</th>
					<th class="py-1.5 text-right label font-normal">Dev. mm</th>
				</tr>
			</thead>
			<tbody class="figures">
				{#each sim.plies as p (p.index)}
					<tr
						class="border-b border-border/60 last:border-0 {p.index === sim.current
							? 'bg-accent'
							: ''}"
					>
						<td class="py-1 pr-2">{p.index + 1}</td>
						<td class="py-1 pr-2">{p.layer + 1}</td>
						<td class="py-1 pr-2">{p.station + 1}</td>
						<td class="py-1 pr-2">
							<span class="flex items-center gap-1.5">
								<AngleGlyph angle={p.angle} size={11} />{angleLabel(p.angle)}
							</span>
						</td>
						<td class="py-1 pr-2 text-right">{fixed(p.cycle, 1, '')}</td>
						<td class="py-1 text-right">
							{#if p.status === 'inspected'}
								<span class={p.pass ? '' : 'text-destructive'}>
									{fixed(p.deviation, 2)}{p.pass ? '' : ' ×'}
								</span>
							{:else}
								<span class="font-sans text-muted-foreground">{statusText[p.status]}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
