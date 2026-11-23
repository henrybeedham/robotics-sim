<script lang="ts">
	import type { Tandem } from '#lib/sim/tandem.svelte.js';
	import Stage, { type CameraView } from '../common/Stage.svelte';
	import Mould from './Mould.svelte';
	import Gantries from './Gantries.svelte';
	import Plies from './Plies.svelte';

	let { sim, view = 0, demo = false }: { sim: Tandem; view?: number; demo?: boolean } = $props();

	const views: CameraView[] = [
		{ position: [8.2, 7.2, 9.6], target: [0, 1.0, 0] },
		{ position: [0, 14, 0.01], target: [0, 0.8, 0] },
		{ position: [0, 2.6, 11], target: [0, 1.4, 0] }
	];
</script>

<Stage {views} {view} {demo} extent={7}>
	<Mould />
	<Gantries {sim} />
	<Plies {sim} />
</Stage>
