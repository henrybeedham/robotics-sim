<script lang="ts">
	/** Steps the simulation once per rendered frame, before anything reads it. */
	import { useTask } from '@threlte/core';
	import type { Simulation } from '#lib/sim/engine.svelte.js';

	let { sim }: { sim: Simulation } = $props();

	useTask('simulation', (delta) => sim.tick(delta));
</script>
