<script lang="ts">
	/** Long, gently cambered tool on a stand, plus the rails, posts and both kit tables. */
	import { T } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial } from 'three';
	import { KITS, MOULD, RAILS, mouldHeight } from '#lib/sim/tandem.svelte.js';
	import { bright, darkPaint, steel, structure, tooling } from '../common/materials';
	import { rbox } from '../common/shapes';
	import Stand from '../common/Stand.svelte';
	import Table from '../common/Table.svelte';
	import Guarding from '../common/Guarding.svelte';

	const nx = 40;
	const ny = 16;
	const pos: number[] = [];
	const idx: number[] = [];
	for (let j = 0; j <= ny; j++)
		for (let i = 0; i <= nx; i++) {
			const x = MOULD.x0 + ((MOULD.x1 - MOULD.x0) * i) / nx;
			const y = MOULD.y0 + ((MOULD.y1 - MOULD.y0) * j) / ny;
			pos.push(x, y, mouldHeight(x, y));
		}
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			const a = j * (nx + 1) + i;
			idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
		}
	const face = new BufferGeometry();
	face.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
	face.setIndex(idx);
	face.computeVertexNormals();
	const toolFace = new MeshStandardMaterial({
		color: '#bdb8af',
		roughness: 0.3,
		metalness: 0.75,
		side: DoubleSide
	});

	const len = MOULD.x1 - MOULD.x0;
	const depth = MOULD.y1 - MOULD.y0;
	const railLen = RAILS.x1 - RAILS.x0;
	const posts = [-5.3, -2.65, 0, 2.65, 5.3];
</script>

<!-- Tool face on a machined plate, on a welded stand -->
<T.Mesh geometry={face} material={toolFace} receiveShadow castShadow />
<T.Mesh
	position={[0, 0, MOULD.base - 0.03]}
	geometry={rbox(len + 0.14, depth + 0.14, 0.06, 0.01)}
	material={tooling}
	castShadow
	receiveShadow
/>
<Stand x={0} y={0} length={len} {depth} height={MOULD.base - 0.06} />

<!-- Runway: an I-beam on each side, on posts with base plates and knee braces -->
{#each [-RAILS.y, RAILS.y] as y (y)}
	<T.Group position={[0, y, RAILS.z]}>
		<T.Mesh
			position={[0, 0, 0.1]}
			geometry={rbox(railLen, 0.2, 0.025, 0.004)}
			material={steel}
			castShadow
		/>
		<T.Mesh geometry={rbox(railLen, 0.025, 0.2, 0.004)} material={steel} castShadow />
		<T.Mesh
			position={[0, 0, -0.1]}
			geometry={rbox(railLen, 0.2, 0.025, 0.004)}
			material={steel}
			castShadow
		/>
		<!-- Running rail on top -->
		<T.Mesh
			position={[0, 0, 0.125]}
			geometry={rbox(railLen, 0.05, 0.025, 0.004)}
			material={bright}
		/>
	</T.Group>
	{#each posts as x (x)}
		<T.Mesh
			position={[x, y, (RAILS.z - 0.11) / 2]}
			geometry={rbox(0.2, 0.2, RAILS.z - 0.11, 0.01)}
			material={structure}
			castShadow
		/>
		<T.Mesh position={[x, y, 0.015]} geometry={rbox(0.4, 0.4, 0.03, 0.006)} material={darkPaint} />
		{#each [-1, 1] as s (s)}
			{#if Math.abs(x + s * 0.4) < RAILS.x1}
				<T.Mesh
					position={[x + s * 0.3, y, RAILS.z - 0.35]}
					rotation.y={s * 0.78}
					geometry={rbox(0.7, 0.07, 0.07, 0.006)}
					material={structure}
				/>
			{/if}
		{/each}
	{/each}
{/each}

{#each KITS as x (x)}
	<Table {x} y={0} top={0.84} length={1.3} depth={1.6} />
{/each}

<Guarding
	x0={RAILS.x0 - 0.3}
	x1={RAILS.x1 + 0.3}
	y0={-RAILS.y - 0.5}
	y1={RAILS.y + 0.5}
	sides={['back', 'left']}
/>
