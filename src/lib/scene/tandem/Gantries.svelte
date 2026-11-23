<script lang="ts">
	/**
	 * Both gantries: bridge on the rails, carriage, vertical axis and vacuum head.
	 * The coloured band on each rail is that gantry's reserved stretch.
	 */
	import { T, useTask } from '@threlte/core';
	import { MeshStandardMaterial } from 'three';
	import { RAILS, type Tandem } from '#lib/sim/tandem.svelte.js';
	import { darkPaint, paint, steel } from '../common/materials';

	let { sim }: { sim: Tandem } = $props();

	const second = new MeshStandardMaterial({ color: '#d9d3c7', roughness: 0.45, metalness: 0.15 });
	const paints = [paint, second];
	const bandMats = [
		new MeshStandardMaterial({ color: '#d4861f', transparent: true, opacity: 0.55 }),
		new MeshStandardMaterial({ color: '#efe9dd', transparent: true, opacity: 0.55 })
	];

	let pos = $state.raw<[number, number, number][]>([
		[0, 0, 0],
		[0, 0, 0]
	]);
	let bands = $state.raw<[number, number][]>([
		[0, 0],
		[0, 0]
	]);

	useTask(
		() => {
			pos = sim.gantries.map((g) => [...g.pos] as [number, number, number]);
			bands = sim.gantries.map(
				(g) =>
					[Math.max(g.reserved[0], RAILS.x0), Math.min(g.reserved[1], RAILS.x1)] as [number, number]
			);
		},
		{ after: 'simulation' }
	);

	const span = RAILS.y * 2 + 0.3;
	const parked = $derived(sim.config.strategy === 'single');
</script>

{#each pos as [x, y, z], i (i)}
	{@const dim = parked && i === 1}
	<T.Group position.x={x}>
		<!-- Bridge and end trucks -->
		<T.Mesh position={[0, 0, RAILS.z + 0.28]} material={paints[i]} castShadow>
			<T.BoxGeometry args={[0.36, span, 0.3]} />
		</T.Mesh>
		{#each [-RAILS.y, RAILS.y] as ry (ry)}
			<T.Mesh position={[0, ry, RAILS.z + 0.16]} material={darkPaint} castShadow>
				<T.BoxGeometry args={[0.6, 0.26, 0.14]} />
			</T.Mesh>
		{/each}
		<!-- Carriage and vertical axis -->
		<T.Group position.y={y}>
			<T.Mesh position={[0.26, 0, RAILS.z + 0.28]} material={darkPaint} castShadow>
				<T.BoxGeometry args={[0.18, 0.4, 0.4]} />
			</T.Mesh>
			<T.Mesh position={[0.26, 0, (z + RAILS.z + 0.6) / 2]} material={steel} castShadow>
				<T.BoxGeometry args={[0.12, 0.12, RAILS.z + 0.6 - z]} />
			</T.Mesh>
			<!-- Head: a flat vacuum plate -->
			<T.Mesh position={[0, 0, z + 0.06]} material={dim ? darkPaint : paints[i]} castShadow>
				<T.BoxGeometry args={[1.0, 0.8, 0.06]} />
			</T.Mesh>
			<T.Mesh position={[0.13, 0, z + 0.12]} material={darkPaint} castShadow>
				<T.BoxGeometry args={[0.36, 0.2, 0.08]} />
			</T.Mesh>
		</T.Group>
	</T.Group>
	<!-- Reserved stretch of rail -->
	{#if !(parked && i === 1)}
		{#each [-RAILS.y, RAILS.y] as ry (ry)}
			<T.Mesh
				position={[(bands[i][0] + bands[i][1]) / 2, ry, RAILS.z + 0.115]}
				material={bandMats[i]}
			>
				<T.BoxGeometry args={[Math.max(0.01, bands[i][1] - bands[i][0]), 0.2, 0.01]} />
			</T.Mesh>
		{/each}
	{/if}
{/each}
