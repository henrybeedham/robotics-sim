<script lang="ts">
	/** Steps the simulation once per rendered frame, before anything reads it. */
	import { useTask } from '@threlte/core';

	let { sim }: { sim: { tick(dt: number): void } } = $props();

	useTask('simulation', (delta) => sim.tick(delta));
</script>
