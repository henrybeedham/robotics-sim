<script lang="ts">
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import Stage, { type CameraView } from '../common/Stage.svelte';
	import Robot from './Robot.svelte';
	import Fixtures from './Fixtures.svelte';
	import Ply from './Ply.svelte';
	import Sensors from './Sensors.svelte';

	let {
		sim,
		view = 0,
		demo = false
	}: { sim: Simulation; view?: number; demo?: boolean } = $props();

	const views: CameraView[] = [
		{ position: [4.6, 3.1, 2.2], target: [0, 0.75, -0.1] },
		{ position: [0.01, 6.2, -0.05], target: [0, 0.6, -0.05] },
		{ position: [0.4, 1.9, -3.6], target: [0, 0.9, -1.0] }
	];
</script>

<Stage {views} {view} {demo}>
	<Fixtures mould={sim.config.mould} />
	<Robot {sim} />
	{#each sim.plies as ply (ply.index + ':' + ply.angle + ':' + sim.config.seed)}
		<Ply {sim} index={ply.index} />
	{/each}
	<Sensors {sim} />
</Stage>
