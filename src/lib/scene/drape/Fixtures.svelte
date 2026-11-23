<script lang="ts">
	/** Static cell furniture: kit table, mould, guarding posts, camera mast and scanner mast. */
	import { T } from '@threlte/core';
	import { DoubleSide, MeshStandardMaterial } from 'three';
	import { KIT, MOULD, type MouldId } from '#lib/sim/cell.js';
	import { darkPaint, steel, tableTop } from '../common/materials';
	import { mouldGeometry } from './meshes';

	let { mould }: { mould: MouldId } = $props();

	const geometry = $derived(mouldGeometry(mould));
	$effect(() => {
		const g = geometry;
		return () => g.dispose();
	});
	const toolFace = new MeshStandardMaterial({
		color: '#bdb8af',
		roughness: 0.3,
		metalness: 0.75,
		side: DoubleSide
	});

	const legs = [
		[-1, -1],
		[1, -1],
		[-1, 1],
		[1, 1]
	] as const;
</script>

<!-- Kit table -->
<T.Mesh position={[0, KIT.y, KIT.top - 0.02]} material={tableTop} receiveShadow castShadow>
	<T.BoxGeometry args={[KIT.length, KIT.depth, 0.04]} />
</T.Mesh>
{#each legs as [sx, sy], i (i)}
	<T.Mesh
		position={[
			sx * (KIT.length / 2 - 0.06),
			KIT.y + sy * (KIT.depth / 2 - 0.06),
			(KIT.top - 0.04) / 2
		]}
		material={darkPaint}
		castShadow
	>
		<T.BoxGeometry args={[0.06, 0.06, KIT.top - 0.04]} />
	</T.Mesh>
{/each}

<!-- Mould on its stand -->
<T.Mesh {geometry} material={toolFace} castShadow receiveShadow />
<T.Mesh position={[MOULD.x, MOULD.y, MOULD.base / 2]} material={darkPaint} castShadow receiveShadow>
	<T.BoxGeometry args={[MOULD.length - 0.1, MOULD.depth - 0.1, MOULD.base]} />
</T.Mesh>

<!-- Camera mast behind the kit table -->
<T.Mesh position={[0, KIT.y - 0.62, 1.1]} material={steel} castShadow>
	<T.BoxGeometry args={[0.08, 0.08, 2.2]} />
</T.Mesh>
<T.Mesh position={[0, KIT.y - 0.45, 2.18]} material={steel} castShadow>
	<T.BoxGeometry args={[0.06, 0.4, 0.06]} />
</T.Mesh>
<T.Mesh position={[0, KIT.y - 0.26, 2.12]} material={darkPaint} castShadow>
	<T.BoxGeometry args={[0.14, 0.12, 0.16]} />
</T.Mesh>

<!-- Scanner mast behind the mould -->
<T.Mesh position={[0, MOULD.y + 0.72, 1.1]} material={steel} castShadow>
	<T.BoxGeometry args={[0.08, 0.08, 2.2]} />
</T.Mesh>
<T.Mesh position={[0, MOULD.y + 0.55, 2.18]} material={steel} castShadow>
	<T.BoxGeometry args={[0.06, 0.4, 0.06]} />
</T.Mesh>
<T.Mesh position={[0, MOULD.y + 0.36, 2.12]} material={darkPaint} castShadow>
	<T.BoxGeometry args={[0.18, 0.12, 0.14]} />
</T.Mesh>
