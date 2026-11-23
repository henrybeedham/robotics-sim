<script lang="ts">
	/**
	 * Conformal vacuum gripper, drawn in the tool frame: +X is the approach
	 * direction and the origin is the cup tips at mid-stroke (the TCP).
	 */
	import { T, useTask } from '@threlte/core';
	import { Color, MeshStandardMaterial } from 'three';
	import { ARM } from '#lib/sim/robot.js';
	import { CUPS, CUP_STROKE } from '#lib/sim/cell.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { darkPaint, steel, rubber, vacuumOn } from './materials';

	let { sim }: { sim: Simulation } = $props();

	const plate = -0.15;
	let ext = $state.raw<number[]>(CUPS.map(() => 0));
	let held = $state(false);
	const heated = new MeshStandardMaterial({ color: '#e39a2c', emissive: new Color('#ff5a10') });

	useTask(
		() => {
			const b = sim.blend;
			ext = CUPS.map(([u, v]) => {
				const e = b * sim.conform(u, v);
				return Math.max(-CUP_STROKE, Math.min(CUP_STROKE, e));
			});
			held = sim.vacuum;
			heated.emissiveIntensity = sim.heat * 1.6;
		},
		{ after: 'simulation' }
	);
</script>

<!-- Adaptor from the flange to the plate -->
<T.Mesh position={[-ARM.tool + 0.05, 0, 0]} material={steel} castShadow>
	<T.BoxGeometry args={[0.1, 0.12, 0.12]} />
</T.Mesh>
<T.Mesh position={[plate - 0.03, 0, 0]} material={darkPaint} castShadow>
	<T.BoxGeometry args={[0.05, 0.66, 0.34]} />
</T.Mesh>
{#each [-0.15, 0.15] as v (v)}
	<T.Mesh position={[plate - 0.07, 0, v]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[0.04, 0.62, 0.04]} />
	</T.Mesh>
{/each}

{#each CUPS as [u, v], i (i)}
	{@const tip = ext[i]}
	{@const rod = tip - 0.02 - plate}
	<T.Mesh
		position={[plate + rod / 2, u, v]}
		rotation.z={Math.PI / 2}
		scale={[1, rod, 1]}
		material={steel}
	>
		<T.CylinderGeometry args={[0.008, 0.008, 1, 10]} />
	</T.Mesh>
	<T.Mesh position={[plate + 0.03, u, v]} rotation.z={Math.PI / 2} material={darkPaint}>
		<T.CylinderGeometry args={[0.016, 0.016, 0.06, 12]} />
	</T.Mesh>
	<T.Mesh
		position={[tip - 0.01, u, v]}
		rotation.z={Math.PI / 2}
		material={sim.heat > 0.02 ? heated : held ? vacuumOn : rubber}
	>
		<T.CylinderGeometry args={[0.022, 0.014, 0.02, 16]} />
	</T.Mesh>
{/each}
