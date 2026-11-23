<script lang="ts">
	/** Phase and clock over the 3D view, plus the camera presets. */
	import Segmented from '#lib/components/drape/Segmented.svelte';
	import { clock } from '#lib/format.js';

	let {
		kicker,
		phase,
		time,
		view = $bindable(0),
		views = ['Overview', 'Plan', 'Side']
	}: { kicker: string; phase: string; time?: number; view?: number; views?: string[] } = $props();
</script>

<div
	class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-3"
>
	<div>
		<div class="label">{kicker}</div>
		<div class="font-display text-lg leading-tight font-medium">{phase}</div>
	</div>
	{#if time !== undefined}
		<div class="text-right">
			<div class="label">Cell time</div>
			<div class="figures text-lg leading-tight">{clock(time)}</div>
		</div>
	{/if}
</div>
<div class="absolute bottom-3 left-3">
	<Segmented
		size="sm"
		label="Camera view"
		options={views.map((v, i) => ({ value: i, label: v }))}
		value={view}
		onchange={(v: number) => (view = v)}
	/>
</div>
<p
	class="pointer-events-none absolute right-3 bottom-3 hidden text-[11px] text-muted-foreground sm:block"
>
	Drag to orbit, scroll to zoom
</p>
