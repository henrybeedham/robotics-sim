<script lang="ts">
	/** The wing box: skins, spars and ribs with their lightening holes. */
	import { T } from '@threlte/core';
	import {
		DoubleSide,
		ExtrudeGeometry,
		Matrix4,
		MeshStandardMaterial,
		Path as ShapePath,
		Quaternion,
		Shape,
		Vector3
	} from 'three';
	import { BOX, RIBS } from '#lib/sim/reach.svelte.js';
	import { darkPaint, tooling } from '../common/materials';

	let { showTop }: { showTop: boolean } = $props();

	const T_SKIN = 0.012;
	const len = BOX.x1 - BOX.x0;
	const width = BOX.y1 - BOX.y0;
	const height = BOX.z1 - BOX.z0;
	const cx = (BOX.x0 + BOX.x1) / 2;
	const cz = (BOX.z0 + BOX.z1) / 2;

	const primer = new MeshStandardMaterial({ color: '#9fae94', roughness: 0.6, metalness: 0.3 });
	const glass = new MeshStandardMaterial({
		color: '#b9c2b2',
		transparent: true,
		opacity: 0.16,
		roughness: 0.4,
		side: DoubleSide,
		depthWrite: false
	});

	// Rib plates are drawn in their own (y, z) plane, then turned to face along X.
	const ribTurn = new Quaternion().setFromRotationMatrix(
		new Matrix4().makeBasis(new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0))
	);
	const ribs = RIBS.map((r) => {
		const s = new Shape();
		s.moveTo(BOX.y0, BOX.z0);
		s.lineTo(BOX.y1, BOX.z0);
		s.lineTo(BOX.y1, BOX.z1);
		s.lineTo(BOX.y0, BOX.z1);
		s.closePath();
		if (r.hole) {
			const h = new ShapePath();
			h.absarc(r.hole.y, r.hole.z, r.hole.r, 0, Math.PI * 2, true);
			s.holes.push(h);
		}
		const g = new ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false, curveSegments: 32 });
		g.translate(0, 0, -0.004);
		return { x: r.x, geometry: g };
	});
</script>

<!-- Lower skin -->
<T.Mesh position={[cx, 0, BOX.z0 - T_SKIN / 2]} material={primer} receiveShadow castShadow>
	<T.BoxGeometry args={[len + 0.1, width + 0.1, T_SKIN]} />
</T.Mesh>
<!-- Upper skin, see-through so the arm stays visible -->
{#if showTop}
	<T.Mesh position={[cx, 0, BOX.z1 + T_SKIN / 2]} material={glass}>
		<T.BoxGeometry args={[len + 0.1, width + 0.1, T_SKIN]} />
	</T.Mesh>
{/if}
<!-- Spars -->
{#each [BOX.y0, BOX.y1] as y (y)}
	<T.Mesh position={[cx, y, cz]} material={y < 0 ? primer : glass} castShadow>
		<T.BoxGeometry args={[len, 0.01, height]} />
	</T.Mesh>
{/each}
{#each ribs as rib (rib.x)}
	<T.Mesh
		geometry={rib.geometry}
		position={[rib.x, 0, 0]}
		quaternion={[ribTurn.x, ribTurn.y, ribTurn.z, ribTurn.w]}
		material={primer}
		castShadow
		receiveShadow
	/>
{/each}

<!-- Assembly stands -->
{#each [0.5, 2.5] as x (x)}
	<T.Mesh position={[x, 0, (BOX.z0 - T_SKIN) / 2]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[0.12, width * 0.8, BOX.z0 - T_SKIN]} />
	</T.Mesh>
{/each}
<!-- Feed rail outside the root rib -->
<T.Mesh position={[-2.2, 0, 0.42]} material={tooling} castShadow>
	<T.BoxGeometry args={[3.6, 0.12, 0.06]} />
</T.Mesh>
{#each [-3.8, -0.6] as x (x)}
	<T.Mesh position={[x, 0, 0.2]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[0.1, 0.1, 0.4]} />
	</T.Mesh>
{/each}
