<script lang="ts">
	/** Long, gently cambered tool on a stand, plus the rails, posts and both kit tables. */
	import { T } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial } from 'three';
	import { KITS, MOULD, RAILS, mouldHeight } from '#lib/sim/tandem.svelte.js';
	import { darkPaint, steel, tableTop } from '../common/materials';

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
	const posts = [-5.2, -2.6, 0, 2.6, 5.2];
</script>

<T.Mesh geometry={face} material={toolFace} receiveShadow castShadow />
<T.Mesh position={[0, 0, MOULD.base / 2 - 0.01]} material={darkPaint} castShadow receiveShadow>
	<T.BoxGeometry args={[len, depth, MOULD.base - 0.02]} />
</T.Mesh>

{#each [-RAILS.y, RAILS.y] as y (y)}
	<T.Mesh position={[0, y, RAILS.z]} material={steel} castShadow>
		<T.BoxGeometry args={[railLen, 0.18, 0.22]} />
	</T.Mesh>
	{#each posts as x (x)}
		<T.Mesh position={[x, y, (RAILS.z - 0.11) / 2]} material={darkPaint} castShadow>
			<T.BoxGeometry args={[0.18, 0.18, RAILS.z - 0.11]} />
		</T.Mesh>
	{/each}
{/each}

{#each KITS as x (x)}
	<T.Mesh position={[x, 0, 0.82]} material={tableTop} castShadow receiveShadow>
		<T.BoxGeometry args={[1.3, 1.6, 0.04]} />
	</T.Mesh>
	<T.Mesh position={[x, 0, 0.4]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[1.1, 1.4, 0.78]} />
	</T.Mesh>
{/each}
