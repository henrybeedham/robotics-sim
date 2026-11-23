<script lang="ts">
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import Viewport from '../common/Viewport.svelte';
	import Scene from './Scene.svelte';

	let {
		sim,
		view = 0,
		demo = false
	}: { sim: Simulation; view?: number; demo?: boolean } = $props();
</script>

<Viewport {sim} {demo}>
	<Scene {sim} {view} {demo} />
</Viewport>
