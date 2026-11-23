<script lang="ts">
	import type { Stack } from '#lib/sim/stack.svelte.js';
	import Stage, { type CameraView } from '../common/Stage.svelte';
	import Cell from './Cell.svelte';
	import Billet from './Billet.svelte';

	let { sim, view = 0, demo = false }: { sim: Stack; view?: number; demo?: boolean } = $props();

	const views: CameraView[] = [
		{ position: [3.6, 3.2, 3.0], target: [-0.4, 0.6, 0] },
		{ position: [-0.6, 7, 0.01], target: [-0.6, 0.5, 0] },
		{ position: [-4.2, 2.2, 2.6], target: [0, 0.8, 0.4] }
	];
	// Rebuild the list only when billets come or go.
	const billets = $derived.by(() => {
		void sim.version;
		return [...sim.billets];
	});
</script>

<Stage {views} {view} {demo} extent={5}>
	<Cell {sim} />
	{#each billets as billet (billet.id)}
		<Billet {sim} {billet} />
	{/each}
</Stage>
