<script lang="ts">
	import { T } from '@threlte/core';
	import { RAIL } from '#lib/sim/robot.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { darkPaint, steel } from '../common/materials';
	import Arm from '../common/Arm.svelte';
	import Gripper from './Gripper.svelte';

	let { sim }: { sim: Simulation } = $props();

	const railLength = RAIL.max - RAIL.min + 0.8;
</script>

<!-- Linear rail on the floor -->
{#each [-0.17, 0.17] as y (y)}
	<T.Mesh position={[0, y, 0.05]} material={steel} castShadow receiveShadow>
		<T.BoxGeometry args={[railLength, 0.07, 0.1]} />
	</T.Mesh>
{/each}
<T.Mesh position={[0, 0, 0.02]} material={darkPaint} receiveShadow>
	<T.BoxGeometry args={[railLength, 0.5, 0.04]} />
</T.Mesh>

<Arm source={sim}>
	{#snippet tool()}
		<Gripper {sim} />
	{/snippet}
</Arm>
