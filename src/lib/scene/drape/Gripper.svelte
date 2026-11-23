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
	import { aluminium, bright, castBlack, darkPaint, rubber, vacuumOn } from '../common/materials';
	import { cyl, rbox, torus } from '../common/shapes';

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

<!-- Tool changer and adaptor from the flange to the plate -->
<T.Mesh
	position={[-ARM.tool + 0.02, 0, 0]}
	rotation.z={Math.PI / 2}
	geometry={cyl(0.07, 0.07, 0.04, 32)}
	material={castBlack}
	castShadow
/>
<T.Mesh
	position={[-ARM.tool + 0.065, 0, 0]}
	geometry={rbox(0.05, 0.14, 0.14, 0.012)}
	material={aluminium}
	castShadow
/>
<!-- Valve manifold on top of the plate -->
<T.Mesh
	position={[plate - 0.075, 0.12, 0]}
	geometry={rbox(0.05, 0.16, 0.08, 0.008)}
	material={castBlack}
	castShadow
/>
<T.Mesh
	position={[plate - 0.075, -0.12, 0]}
	geometry={rbox(0.05, 0.16, 0.08, 0.008)}
	material={castBlack}
	castShadow
/>
<!-- Plate: an aluminium sheet stiffened by two profile beams -->
<T.Mesh
	position={[plate - 0.03, 0, 0]}
	geometry={rbox(0.03, 0.68, 0.34, 0.008)}
	material={aluminium}
	castShadow
/>
{#each [-0.15, 0.15] as v (v)}
	<T.Mesh
		position={[plate - 0.065, 0, v]}
		geometry={rbox(0.04, 0.64, 0.04, 0.005)}
		material={darkPaint}
		castShadow
	/>
{/each}

{#each CUPS as [u, v], i (i)}
	{@const tip = ext[i]}
	{@const rod = tip - 0.035 - plate}
	{@const cupMat = sim.heat > 0.02 ? heated : held ? vacuumOn : rubber}
	<!-- Actuator body, rod, then a bellows cup -->
	<T.Mesh
		position={[plate + 0.03, u, v]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.017, 0.017, 0.06, 16)}
		material={castBlack}
	/>
	<T.Mesh
		position={[plate + 0.03 + rod / 2, u, v]}
		rotation.z={Math.PI / 2}
		scale={[1, rod, 1]}
		geometry={cyl(0.007, 0.007, 1, 10)}
		material={bright}
	/>
	<T.Mesh
		position={[tip - 0.03, u, v]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.012, 0.012, 0.01, 12)}
		material={bright}
	/>
	{#each [0.022, 0.012] as o (o)}
		<T.Mesh
			position={[tip - o, u, v]}
			rotation.y={Math.PI / 2}
			geometry={torus(0.014, 0.0055)}
			material={cupMat}
		/>
	{/each}
	<T.Mesh
		position={[tip - 0.004, u, v]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.021, 0.014, 0.008, 18)}
		material={cupMat}
	/>
{/each}
