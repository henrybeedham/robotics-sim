<script lang="ts">
	/** Roller conveyor, camera arch, reject bay, pallet and the arm with its magnet gripper. */
	import { T } from '@threlte/core';
	import { InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
	import { onDestroy } from 'svelte';
	import { BILLET, CONVEYOR, PALLET, type Stack } from '#lib/sim/stack.svelte.js';
	import {
		aluminium,
		bright,
		castBlack,
		darkPaint,
		paint,
		safety,
		steel,
		structure,
		tooling,
		vacuumOn
	} from '../common/materials';
	import { cyl, rbox } from '../common/shapes';
	import Arm from '../common/Arm.svelte';
	import Guarding from '../common/Guarding.svelte';

	let { sim }: { sim: Stack } = $props();

	const len = CONVEYOR.x1 - CONVEYOR.x0;
	const cx = (CONVEYOR.x0 + CONVEYOR.x1) / 2;
	const wood = new MeshStandardMaterial({ color: '#b39066', roughness: 0.92 });
	const woodDark = new MeshStandardMaterial({ color: '#94744f', roughness: 0.92 });

	// Rollers along the conveyor.
	const PITCH = 0.16;
	const count = Math.floor(len / PITCH);
	const rollers = new InstancedMesh(cyl(0.032, 0.032, 1.04, 20), bright, count);
	rollers.receiveShadow = true;
	const m = new Matrix4();
	for (let i = 0; i < count; i++) {
		m.makeTranslation(CONVEYOR.x0 + 0.08 + i * PITCH, CONVEYOR.y, CONVEYOR.top - 0.032);
		rollers.setMatrixAt(i, m);
	}
	onDestroy(() => rollers.dispose());

	const legs = [-3.1, -2, -0.9, 0.2, 1.3];
	const boards = [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42];
</script>

<!-- Conveyor: side frames, legs with feet, rollers, drive motor -->
{#each [-0.56, 0.56] as dy (dy)}
	<T.Mesh
		position={[cx, CONVEYOR.y + dy, CONVEYOR.top - 0.05]}
		geometry={rbox(len, 0.06, 0.14, 0.008)}
		material={structure}
		castShadow
	/>
	<!-- Side guides keep billets on the rollers -->
	<T.Mesh
		position={[cx, CONVEYOR.y + dy * 1.02, CONVEYOR.top + 0.06]}
		geometry={rbox(len, 0.02, 0.05, 0.006)}
		material={steel}
	/>
	{#each legs as x (x)}
		<T.Mesh
			position={[x, CONVEYOR.y + dy, (CONVEYOR.top - 0.12) / 2]}
			geometry={rbox(0.07, 0.07, CONVEYOR.top - 0.12, 0.006)}
			material={darkPaint}
			castShadow
		/>
		<T.Mesh
			position={[x, CONVEYOR.y + dy, 0.01]}
			geometry={rbox(0.16, 0.16, 0.02, 0.004)}
			material={darkPaint}
		/>
	{/each}
{/each}
<T is={rollers} />
<T.Group position={[CONVEYOR.x0 + 0.4, CONVEYOR.y - 0.7, CONVEYOR.top - 0.1]}>
	<T.Mesh geometry={rbox(0.26, 0.2, 0.2, 0.03)} material={castBlack} castShadow />
	<T.Mesh
		position={[0, 0.17, 0]}
		geometry={cyl(0.08, 0.08, 0.16, 24)}
		material={castBlack}
		castShadow
	/>
</T.Group>

<!-- Camera arch that measures each billet's offset and angle -->
{#each [-0.75, 0.75] as dy (dy)}
	<T.Mesh
		position={[-2.2, CONVEYOR.y + dy, 0.85]}
		geometry={rbox(0.08, 0.08, 1.7, 0.006)}
		material={aluminium}
		castShadow
	/>
{/each}
<T.Mesh
	position={[-2.2, CONVEYOR.y, 1.7]}
	geometry={rbox(0.1, 1.6, 0.1, 0.008)}
	material={aluminium}
	castShadow
/>
<T.Group position={[-2.2, CONVEYOR.y, 1.58]}>
	<T.Mesh geometry={rbox(0.14, 0.14, 0.12, 0.02)} material={castBlack} />
	<T.Mesh
		position={[0, 0, -0.08]}
		rotation.x={Math.PI / 2}
		geometry={cyl(0.035, 0.03, 0.05, 20)}
		material={castBlack}
	/>
</T.Group>

<!-- Reject bay at the end of the line -->
<T.Group position={[CONVEYOR.x1 + 0.38, CONVEYOR.y, 0]}>
	<T.Mesh
		position={[0, 0, 0.03]}
		geometry={rbox(0.72, 1.24, 0.06, 0.01)}
		material={tooling}
		receiveShadow
	/>
	{#each [-0.6, 0.6] as dy (dy)}
		<T.Mesh
			position={[0, dy, 0.3]}
			geometry={rbox(0.72, 0.04, 0.6, 0.008)}
			material={safety}
			castShadow
		/>
	{/each}
	<T.Mesh
		position={[0.34, 0, 0.3]}
		geometry={rbox(0.04, 1.24, 0.6, 0.008)}
		material={safety}
		castShadow
	/>
</T.Group>

<!-- Pallet: top boards on three stringers -->
{#each boards as dy (dy)}
	<T.Mesh
		position={[PALLET.x, PALLET.y + dy, PALLET.top - 0.011]}
		geometry={rbox(PALLET.size, 0.15, 0.022, 0.003)}
		material={wood}
		receiveShadow
		castShadow
	/>
{/each}
{#each [-0.44, 0, 0.44] as dx (dx)}
	<T.Mesh
		position={[PALLET.x + dx, PALLET.y, (PALLET.top - 0.022) / 2]}
		geometry={rbox(0.1, PALLET.size, PALLET.top - 0.022, 0.004)}
		material={woodDark}
		castShadow
	/>
{/each}

<!-- Robot plinth and arm -->
<T.Mesh
	position={[0, 0, 0.05]}
	geometry={rbox(0.85, 0.85, 0.1, 0.01)}
	material={darkPaint}
	receiveShadow
	castShadow
/>
<Arm source={sim}>
	{#snippet tool()}
		<!-- Tool changer, then a beam carrying three electro-magnet pads -->
		<T.Mesh
			position={[-0.24, 0, 0]}
			rotation.z={Math.PI / 2}
			geometry={cyl(0.07, 0.07, 0.04, 32)}
			material={castBlack}
			castShadow
		/>
		<T.Mesh
			position={[-0.18, 0, 0]}
			geometry={rbox(0.08, 0.14, 0.14, 0.015)}
			material={aluminium}
			castShadow
		/>
		<T.Mesh
			position={[-0.11, 0, 0]}
			geometry={rbox(0.06, BILLET.length * 0.88, 0.1, 0.012)}
			material={paint}
			castShadow
		/>
		{#each [-0.32, 0, 0.32] as u (u)}
			<T.Mesh
				position={[-0.055, u, 0]}
				geometry={rbox(0.05, 0.12, 0.13, 0.01)}
				material={castBlack}
			/>
			<T.Mesh
				position={[-0.02, u, 0]}
				geometry={rbox(0.03, 0.16, 0.14, 0.006)}
				material={sim.held ? vacuumOn : steel}
			/>
		{/each}
		<T.Mesh
			position={[-0.13, 0.2, 0.06]}
			geometry={rbox(0.05, 0.12, 0.04, 0.008)}
			material={castBlack}
		/>
	{/snippet}
</Arm>

<Guarding x0={-3.7} x1={2.6} y0={-2.0} y1={2.0} sides={['back', 'left']} />
