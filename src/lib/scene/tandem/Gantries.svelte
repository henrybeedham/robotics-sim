<script lang="ts">
	/**
	 * Both gantries: bridge on the rails, carriage, vertical axis and vacuum head.
	 * The coloured band on each rail is that gantry's reserved stretch.
	 */
	import { T, useTask } from '@threlte/core';
	import { MeshStandardMaterial } from 'three';
	import { RAILS, type Tandem } from '#lib/sim/tandem.svelte.js';
	import {
		aluminium,
		bright,
		cable,
		castBlack,
		darkPaint,
		paint,
		rubber
	} from '../common/materials';
	import { cyl, rbox } from '../common/shapes';

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
	const cups = [-0.42, -0.21, 0, 0.21, 0.42].flatMap((cx) =>
		[-0.32, -0.11, 0.11, 0.32].map((cy) => [cx, cy] as const)
	);
	const parked = $derived(sim.config.strategy === 'single');
</script>

{#each pos as [x, y, z], i (i)}
	{@const dim = parked && i === 1}
	<T.Group position.x={x}>
		<!-- Box-section bridge with end trucks running on the rails -->
		<T.Mesh
			position={[0, 0, RAILS.z + 0.36]}
			geometry={rbox(0.36, span, 0.3, 0.04)}
			material={paints[i]}
			castShadow
		/>
		<T.Mesh
			position={[0, 0, RAILS.z + 0.2]}
			geometry={rbox(0.3, span - 0.4, 0.03, 0.01)}
			material={darkPaint}
		/>
		{#each [-RAILS.y, RAILS.y] as ry (ry)}
			<T.Mesh
				position={[0, ry, RAILS.z + 0.24]}
				geometry={rbox(0.8, 0.28, 0.16, 0.03)}
				material={darkPaint}
				castShadow
			/>
			{#each [-0.28, 0.28] as wx (wx)}
				<T.Mesh
					position={[wx, ry, RAILS.z + 0.17]}
					geometry={cyl(0.06, 0.06, 0.06, 24)}
					material={bright}
				/>
			{/each}
			<!-- Drive motor on the end truck -->
			<T.Mesh
				position={[0.2, ry + Math.sign(ry) * 0.2, RAILS.z + 0.26]}
				geometry={cyl(0.07, 0.07, 0.16, 24)}
				material={castBlack}
				castShadow
			/>
		{/each}
		<!-- Carriage on the bridge, then the vertical axis and the head -->
		<T.Group position.y={y}>
			<T.Mesh
				position={[0.25, 0, RAILS.z + 0.36]}
				geometry={rbox(0.16, 0.5, 0.44, 0.03)}
				material={darkPaint}
				castShadow
			/>
			<T.Mesh
				position={[0.25, 0, RAILS.z + 0.62]}
				geometry={cyl(0.06, 0.06, 0.16, 20)}
				material={castBlack}
				castShadow
			/>
			<T.Mesh
				position={[0.25, 0, (z + RAILS.z + 0.7) / 2]}
				geometry={rbox(0.14, 0.14, RAILS.z + 0.7 - z, 0.02)}
				material={aluminium}
				castShadow
			/>
			<!-- Head: profile frame carrying a grid of vacuum cups -->
			<T.Mesh
				position={[0, 0, z + 0.11]}
				geometry={rbox(1.04, 0.84, 0.04, 0.012)}
				material={dim ? darkPaint : paints[i]}
				castShadow
			/>
			<T.Mesh
				position={[0.13, 0, z + 0.16]}
				geometry={rbox(0.4, 0.22, 0.08, 0.02)}
				material={castBlack}
				castShadow
			/>
			{#each cups as [cxp, cyp], k (k)}
				<T.Mesh
					position={[cxp, cyp, z + 0.07]}
					rotation.x={Math.PI / 2}
					geometry={cyl(0.012, 0.012, 0.05, 10)}
					material={bright}
				/>
				<T.Mesh
					position={[cxp, cyp, z + 0.04]}
					rotation.x={Math.PI / 2}
					geometry={cyl(0.026, 0.018, 0.016, 14)}
					material={rubber}
				/>
			{/each}
		</T.Group>
	</T.Group>
	<!-- Cable chain along the outside of the runway, following the bridge -->
	{#if !(parked && i === 1)}
		{@const ry = i === 0 ? -RAILS.y - 0.32 : RAILS.y + 0.32}
		{@const anchor = i === 0 ? RAILS.x0 + 0.6 : RAILS.x1 - 0.6}
		<T.Mesh
			position={[(anchor + x) / 2, ry, RAILS.z + 0.08]}
			geometry={rbox(1, 0.1, 0.08, 0.02)}
			scale={[Math.max(0.05, Math.abs(x - anchor)), 1, 1]}
			material={cable}
		/>
		<!-- Reserved stretch of rail -->
		{#each [-RAILS.y, RAILS.y] as rry (rry)}
			<T.Mesh
				position={[(bands[i][0] + bands[i][1]) / 2, rry, RAILS.z + 0.14]}
				material={bandMats[i]}
			>
				<T.BoxGeometry args={[Math.max(0.01, bands[i][1] - bands[i][0]), 0.22, 0.012]} />
			</T.Mesh>
		{/each}
	{/if}
{/each}
