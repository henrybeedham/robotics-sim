<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '#lib/components/ui/button/index.js';
	import Segmented from '#lib/components/drape/Segmented.svelte';

	let {
		status,
		warp,
		onwarp,
		ontoggle,
		onreset,
		startLabel = 'Start',
		warps = [1, 2, 4, 8]
	}: {
		status: string;
		warp: number;
		onwarp: (w: number) => void;
		ontoggle: () => void;
		onreset: () => void;
		startLabel?: string;
		warps?: number[];
	} = $props();

	const label = $derived(
		status === 'running'
			? 'Pause'
			: status === 'paused'
				? 'Resume'
				: status === 'done'
					? 'Run again'
					: startLabel
	);
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button onclick={ontoggle} disabled={status === 'error'} class="min-w-28">
		{#if status === 'running'}<Pause strokeWidth={1.5} />{:else}<Play strokeWidth={1.5} />{/if}
		{label}
	</Button>
	<Button variant="outline" onclick={onreset} disabled={status === 'idle'}>
		<RotateCcw strokeWidth={1.5} /> Reset
	</Button>
	<div class="ml-auto">
		<Segmented
			label="Playback speed"
			options={warps.map((w) => ({ value: w, label: `${w}×` }))}
			value={warp}
			onchange={onwarp}
		/>
	</div>
</div>
