<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Canvas } from '@threlte/core';
	import { PCFSoftShadowMap } from 'three';
	import Driver from './Driver.svelte';

	let {
		sim,
		demo = false,
		children
	}: { sim: { tick(dt: number): void }; demo?: boolean; children: Snippet } = $props();

	const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
</script>

<Canvas shadows={demo ? false : PCFSoftShadowMap} dpr={demo ? 1 : Math.min(2, dpr)}>
	<Driver {sim} />
	{@render children()}
</Canvas>
