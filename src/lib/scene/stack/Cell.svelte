<script lang="ts">
	/** Conveyor, camera arch, reject bay, pallet and the arm with its billet gripper. */
	import { T, useTask } from '@threlte/core';
	import { InstancedMesh, BoxGeometry, Matrix4, MeshStandardMaterial } from 'three';
	import { onDestroy } from 'svelte';
	import { BILLET, CONVEYOR, PALLET, type Stack } from '#lib/sim/stack.svelte.js';
	import { darkPaint, steel, tooling, vacuumOn } from '../common/materials';
	import Arm from '../common/Arm.svelte';

	let { sim }: { sim: Stack } = $props();

	const len = CONVEYOR.x1 - CONVEYOR.x0;
	const cx = (CONVEYOR.x0 + CONVEYOR.x1) / 2;
	const wood = new MeshStandardMaterial({ color: '#a88a62', roughness: 0.9 });

	// Chain slats that move with the conveyor.
	const PITCH = 0.2;
	const count = Math.floor(len / PITCH);
	const slats = new InstancedMesh(new BoxGeometry(0.05, 1.0, 0.02), steel, count);
	slats.receiveShadow = true;
	let offset = 0;
	const m = new Matrix4();
	let lastTime = 0;
	useTask(
		() => {
			const dt = sim.time - lastTime;
			lastTime = sim.time;
			if (sim.conveyorRunning && dt > 0) offset = (offset + sim.config.speed * dt) % PITCH;
			if (dt < 0) offset = 0;
			for (let i = 0; i < count; i++) {
				m.makeTranslation(CONVEYOR.x0 + i * PITCH + offset, CONVEYOR.y, CONVEYOR.top - 0.01);
				slats.setMatrixAt(i, m);
			}
			slats.instanceMatrix.needsUpdate = true;
		},
		{ after: 'simulation' }
	);
	onDestroy(() => slats.geometry.dispose());
</script>

<!-- Conveyor frame -->
{#each [-0.55, 0.55] as dy (dy)}
	<T.Mesh position={[cx, CONVEYOR.y + dy, CONVEYOR.top - 0.06]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[len, 0.08, 0.12]} />
	</T.Mesh>
{/each}
{#each [-3, -1.5, 0, 1.4] as x (x)}
	{#each [-0.5, 0.5] as dy (dy)}
		<T.Mesh position={[x, CONVEYOR.y + dy, (CONVEYOR.top - 0.12) / 2]} material={darkPaint}>
			<T.BoxGeometry args={[0.08, 0.08, CONVEYOR.top - 0.12]} />
		</T.Mesh>
	{/each}
{/each}
<T is={slats} />

<!-- Camera arch that measures each billet's offset and angle -->
{#each [-0.75, 0.75] as dy (dy)}
	<T.Mesh position={[-2.2, CONVEYOR.y + dy, 0.85]} material={steel} castShadow>
		<T.BoxGeometry args={[0.08, 0.08, 1.7]} />
	</T.Mesh>
{/each}
<T.Mesh position={[-2.2, CONVEYOR.y, 1.7]} material={steel} castShadow>
	<T.BoxGeometry args={[0.1, 1.6, 0.1]} />
</T.Mesh>
<T.Mesh position={[-2.2, CONVEYOR.y, 1.6]} material={darkPaint}>
	<T.BoxGeometry args={[0.14, 0.14, 0.1]} />
</T.Mesh>

<!-- Reject bay at the end of the line -->
<T.Group position={[CONVEYOR.x1 + 0.35, CONVEYOR.y, 0]}>
	<T.Mesh position={[0, 0, 0.02]} material={tooling} receiveShadow>
		<T.BoxGeometry args={[0.7, 1.2, 0.04]} />
	</T.Mesh>
	{#each [-0.6, 0.6] as dy (dy)}
		<T.Mesh position={[0, dy, 0.25]} material={darkPaint}>
			<T.BoxGeometry args={[0.7, 0.04, 0.5]} />
		</T.Mesh>
	{/each}
	<T.Mesh position={[0.35, 0, 0.25]} material={darkPaint}>
		<T.BoxGeometry args={[0.04, 1.2, 0.5]} />
	</T.Mesh>
</T.Group>

<!-- Pallet -->
<T.Mesh position={[PALLET.x, PALLET.y, PALLET.top - 0.03]} material={wood} receiveShadow castShadow>
	<T.BoxGeometry args={[PALLET.size, PALLET.size, 0.03]} />
</T.Mesh>
{#each [-0.42, 0, 0.42] as dx (dx)}
	<T.Mesh position={[PALLET.x + dx, PALLET.y, (PALLET.top - 0.03) / 2]} material={wood} castShadow>
		<T.BoxGeometry args={[0.12, PALLET.size, PALLET.top - 0.03]} />
	</T.Mesh>
{/each}

<!-- Robot plinth and arm -->
<T.Mesh position={[0, 0, 0.04]} material={darkPaint} receiveShadow>
	<T.BoxGeometry args={[0.8, 0.8, 0.08]} />
</T.Mesh>
<Arm source={sim}>
	{#snippet tool()}
		<!-- Magnet beam along the billet, pads at the tool centre point -->
		<T.Mesh position={[-0.2, 0, 0]} material={steel} castShadow>
			<T.BoxGeometry args={[0.14, 0.12, 0.12]} />
		</T.Mesh>
		<T.Mesh position={[-0.1, 0, 0]} material={darkPaint} castShadow>
			<T.BoxGeometry args={[0.06, BILLET.length * 0.85, 0.1]} />
		</T.Mesh>
		{#each [-0.3, 0, 0.3] as u (u)}
			<T.Mesh position={[-0.035, u, 0]} material={sim.held ? vacuumOn : darkPaint}>
				<T.BoxGeometry args={[0.07, 0.16, 0.12]} />
			</T.Mesh>
		{/each}
	{/snippet}
</Arm>
