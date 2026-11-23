<script lang="ts">
	/** A soft studio environment so metals and clear-coat paint have something to reflect. */
	import { useThrelte } from '@threlte/core';
	import { PMREMGenerator } from 'three';
	import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
	import { onDestroy } from 'svelte';

	let { intensity = 0.55 }: { intensity?: number } = $props();

	const { renderer, scene, invalidate } = useThrelte();
	const pmrem = new PMREMGenerator(renderer);
	const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = env;
	$effect(() => {
		scene.environmentIntensity = intensity;
		invalidate();
	});

	onDestroy(() => {
		scene.environment = null;
		env.dispose();
		pmrem.dispose();
	});
</script>
