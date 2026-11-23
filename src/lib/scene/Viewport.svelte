<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { PCFSoftShadowMap } from 'three';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import Scene from './Scene.svelte';
	import Driver from './Driver.svelte';

	let { sim, view }: { sim: Simulation; view: number } = $props();
</script>

<Canvas
	shadows={PCFSoftShadowMap}
	dpr={Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)}
>
	<Driver {sim} />
	<Scene {sim} {view} />
</Canvas>
