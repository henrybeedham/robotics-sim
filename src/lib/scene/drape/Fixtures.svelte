<script lang="ts">
	/** Static cell furniture: kit table, mould, guarding posts, camera mast and scanner mast. */
	import { T } from '@threlte/core';
	import { Color, DoubleSide, MeshStandardMaterial } from 'three';
	import { KIT, MOULD, type MouldId } from '#lib/sim/cell.js';
	import { aluminium, castBlack, darkPaint, tooling } from '../common/materials';
	import { cyl, rbox, torus } from '../common/shapes';
	import Table from '../common/Table.svelte';
	import Stand from '../common/Stand.svelte';
	import Guarding from '../common/Guarding.svelte';
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

	const lens = new MeshStandardMaterial({ color: '#0d1620', roughness: 0.05, metalness: 0.9 });
	const ringLight = new MeshStandardMaterial({
		color: '#ffffff',
		emissive: new Color('#dff0ff'),
		emissiveIntensity: 0.8
	});
	const laserWindow = new MeshStandardMaterial({
		color: '#401010',
		emissive: new Color('#ff3a1a'),
		emissiveIntensity: 0.6
	});
</script>

<Table x={0} y={KIT.y} top={KIT.top} length={KIT.length} depth={KIT.depth} />

<!-- Mould: tool face on a machined base plate, on a welded stand -->
<T.Mesh {geometry} material={toolFace} castShadow receiveShadow />
<T.Mesh
	position={[MOULD.x, MOULD.y, MOULD.base - 0.03]}
	geometry={rbox(MOULD.length + 0.12, MOULD.depth + 0.12, 0.06, 0.01)}
	material={tooling}
	castShadow
	receiveShadow
/>
<Stand
	x={MOULD.x}
	y={MOULD.y}
	length={MOULD.length}
	depth={MOULD.depth}
	height={MOULD.base - 0.06}
/>

<!-- Camera mast behind the kit table -->
<T.Mesh
	position={[0, KIT.y - 0.62, 1.1]}
	geometry={rbox(0.08, 0.08, 2.2, 0.006)}
	material={aluminium}
	castShadow
/>
<T.Mesh
	position={[0, KIT.y - 0.62, 0.02]}
	geometry={rbox(0.3, 0.3, 0.04, 0.006)}
	material={darkPaint}
/>
<T.Mesh
	position={[0, KIT.y - 0.45, 2.18]}
	geometry={rbox(0.06, 0.4, 0.06, 0.006)}
	material={aluminium}
	castShadow
/>
<T.Group position={[0, KIT.y - 0.26, 2.12]}>
	<T.Mesh geometry={rbox(0.12, 0.14, 0.12, 0.02)} material={castBlack} castShadow />
	<T.Mesh
		position={[0, 0, -0.08]}
		rotation.x={Math.PI / 2}
		geometry={cyl(0.035, 0.03, 0.05, 24)}
		material={castBlack}
	/>
	<T.Mesh
		position={[0, 0, -0.106]}
		rotation.x={Math.PI / 2}
		geometry={cyl(0.026, 0.026, 0.004, 24)}
		material={lens}
	/>
	<!-- Ring light -->
	<T.Mesh position={[0, 0, -0.1]} geometry={torus(0.06, 0.008)} material={ringLight} />
</T.Group>

<!-- Laser scanner mast behind the mould -->
<T.Mesh
	position={[0, MOULD.y + 0.72, 1.1]}
	geometry={rbox(0.08, 0.08, 2.2, 0.006)}
	material={aluminium}
	castShadow
/>
<T.Mesh
	position={[0, MOULD.y + 0.72, 0.02]}
	geometry={rbox(0.3, 0.3, 0.04, 0.006)}
	material={darkPaint}
/>
<T.Mesh
	position={[0, MOULD.y + 0.55, 2.18]}
	geometry={rbox(0.06, 0.4, 0.06, 0.006)}
	material={aluminium}
	castShadow
/>
<T.Group position={[0, MOULD.y + 0.36, 2.12]}>
	<T.Mesh geometry={rbox(0.2, 0.12, 0.12, 0.02)} material={castBlack} castShadow />
	<T.Mesh
		position={[0, 0, -0.062]}
		geometry={rbox(0.14, 0.02, 0.006, 0.002)}
		material={laserWindow}
	/>
</T.Group>

<Guarding x0={-2.5} x1={2.5} y0={-2.1} y1={2.2} sides={['back', 'left']} />
