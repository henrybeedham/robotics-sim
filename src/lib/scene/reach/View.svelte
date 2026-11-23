<script lang="ts">
	import type { Reach } from '#lib/sim/reach.svelte.js';
	import Viewport from '../common/Viewport.svelte';
	import Scene from './Scene.svelte';

	let {
		sim,
		view = 0,
		demo = false,
		seeThrough = true
	}: { sim: Reach; view?: number; demo?: boolean; seeThrough?: boolean } = $props();
</script>

<Viewport {sim} {demo}>
	<Scene {sim} {view} {demo} {seeThrough} />
</Viewport>
