<script lang="ts">
	import type { Stack } from '#lib/sim/stack.svelte.js';
	import Viewport from '../common/Viewport.svelte';
	import Scene from './Scene.svelte';

	let { sim, view = 0, demo = false }: { sim: Stack; view?: number; demo?: boolean } = $props();
</script>

<Viewport {sim} {demo}>
	<Scene {sim} {view} {demo} />
</Viewport>
