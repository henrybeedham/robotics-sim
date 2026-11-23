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
	import { aluminium, castBlack, darkPaint, structure } from '../common/materials';
	import { rbox } from '../common/shapes';
	import Stand from '../common/Stand.svelte';

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
	// Stringers: T-sections running spanwise along the lower skin, notched at each rib.
	const stringers = [-0.33, -0.2, 0.2, 0.33];
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

{#each stringers as y (y)}
	<T.Mesh
		position={[cx, y, BOX.z0 + 0.003]}
		geometry={rbox(len - 0.02, 0.03, 0.006, 0.002)}
		material={primer}
		castShadow
	/>
	<T.Mesh
		position={[cx, y, BOX.z0 + 0.025]}
		geometry={rbox(len - 0.02, 0.005, 0.044, 0.002)}
		material={primer}
		castShadow
	/>
{/each}
<!-- Rib flanges along the top and bottom of each rib -->
{#each RIBS as r (r.x)}
	{#each [BOX.z0 + 0.008, BOX.z1 - 0.008] as z (z)}
		<T.Mesh
			position={[r.x + 0.015, 0, z]}
			geometry={rbox(0.03, width - 0.01, 0.004, 0.001)}
			material={primer}
		/>
	{/each}
{/each}

<!-- Assembly jig: welded stand with pick-up pads under the box -->
<Stand x={cx} y={0} length={len + 0.2} depth={width - 0.1} height={BOX.z0 - T_SKIN - 0.04} />
{#each [0.3, 1.5, 2.7] as x (x)}
	{#each [-0.3, 0.3] as y (y)}
		<T.Mesh
			position={[x, y, BOX.z0 - T_SKIN - 0.02]}
			geometry={rbox(0.08, 0.08, 0.04, 0.006)}
			material={aluminium}
		/>
	{/each}
{/each}

<!-- Feed rail outside the root rib, on two pedestals -->
<T.Mesh
	position={[-2.2, 0, 0.42]}
	geometry={rbox(3.6, 0.14, 0.06, 0.01)}
	material={aluminium}
	castShadow
/>
<T.Mesh position={[-2.2, 0, 0.455]} geometry={rbox(3.6, 0.04, 0.02, 0.004)} material={castBlack} />
{#each [-3.8, -0.6] as x (x)}
	<T.Mesh
		position={[x, 0, 0.2]}
		geometry={rbox(0.12, 0.12, 0.4, 0.01)}
		material={structure}
		castShadow
	/>
	<T.Mesh position={[x, 0, 0.01]} geometry={rbox(0.3, 0.3, 0.02, 0.004)} material={darkPaint} />
{/each}
