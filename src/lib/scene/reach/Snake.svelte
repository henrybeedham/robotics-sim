<script lang="ts">
	/**
	 * The snake arm: instanced links and joints, coloured by clearance. Its base
	 * runs through a fixed drive unit near the access hole; anything behind the
	 * drive is stored on a drum, so long arms don't need a long rail.
	 */
	import { T, useTask } from '@threlte/core';
	import {
		Color,
		InstancedMesh,
		Matrix4,
		MeshStandardMaterial,
		Object3D,
		Quaternion,
		SphereGeometry,
		SpotLight,
		Vector3
	} from 'three';
	import { onDestroy, untrack } from 'svelte';
	import { SNAKE, type Reach } from '#lib/sim/reach.svelte.js';
	import { bright, castBlack, darkPaint, paint, structure } from '../common/materials';
	import { cyl, rbox, torus } from '../common/shapes';

	let { sim }: { sim: Reach } = $props();

	// The scene re-creates this component whenever the structure changes.
	const level = untrack(() => sim.level);
	const N = level.links;
	const ex = level.entry;
	/** The drive grips the arm here; behind it the arm is on the drum. */
	const DRIVE = -1.5;

	const linkMat = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
	const links = new InstancedMesh(cyl(SNAKE.radius, SNAKE.radius, 1, 16), linkMat, N);
	const jointGeo = new SphereGeometry(SNAKE.radius * 1.12, 14, 10);
	const joints = new InstancedMesh(jointGeo, castBlack, N + 1);
	links.castShadow = joints.castShadow = true;
	links.frustumCulled = joints.frustumCulled = false;

	const ok = new Color('#d4861f');
	const tight = new Color('#d8402a');
	const up = new Vector3(0, 1, 0);
	const m = new Matrix4();
	const q = new Quaternion();
	const dir = new Vector3();
	const mid = new Vector3();
	const one = new Vector3(1, 1, 1);
	const hidden = new Matrix4().makeScale(0, 0, 0);
	let tip = $state<[number, number, number]>([0, 0, 0]);
	let tipQ = $state<[number, number, number, number]>([0, 0, 0, 1]);

	// Work lamp on the tip: a spot light whose target rides along in front of it.
	const lamp = new SpotLight('#fff4e0', 0.9, 1.8, 0.75, 0.7, 2);
	const aim = new Object3D();
	aim.position.set(0, 1, 0);
	lamp.add(aim);
	lamp.target = aim;

	useTask(
		() => {
			const { joints: js, clearance } = sim.pose;
			if (js.length < N + 1) return;
			for (let i = 0; i < N; i++) {
				if (js[i].x < DRIVE && js[i + 1].x < DRIVE) {
					links.setMatrixAt(i, hidden);
					continue;
				}
				dir.subVectors(js[i], js[i + 1]);
				const len = dir.length();
				q.setFromUnitVectors(up, dir.normalize());
				mid.addVectors(js[i], js[i + 1]).multiplyScalar(0.5);
				m.compose(mid, q, new Vector3(1, Math.max(len, 1e-4), 1));
				links.setMatrixAt(i, m);
				links.setColorAt(i, clearance[i] < 8 ? tight : ok);
			}
			for (let i = 0; i <= N; i++)
				joints.setMatrixAt(i, js[i].x < DRIVE ? hidden : m.compose(js[i], q.identity(), one));
			links.instanceMatrix.needsUpdate = true;
			if (links.instanceColor) links.instanceColor.needsUpdate = true;
			joints.instanceMatrix.needsUpdate = true;
			tip = [js[0].x, js[0].y, js[0].z];
			dir.subVectors(js[0], js[1]).normalize();
			q.setFromUnitVectors(up, dir);
			tipQ = [q.x, q.y, q.z, q.w];
		},
		{ after: 'simulation' }
	);

	onDestroy(() => {
		links.dispose();
		joints.dispose();
		jointGeo.dispose();
		linkMat.dispose();
		lamp.dispose();
	});

	const coils = [0, 1, 2, 3, 4];
</script>

<T is={links} />
<T is={joints} />

<!-- Tool head: camera, lamp ring, and the work light itself -->
<T.Group position={tip} quaternion={tipQ}>
	<T.Mesh position={[0, 0.025, 0]} geometry={cyl(0.024, 0.03, 0.05, 20)} material={castBlack} />
	<T.Mesh position={[0, 0.052, 0]} geometry={torus(0.02, 0.004)} rotation.x={Math.PI / 2}>
		<T.MeshStandardMaterial color="#ffffff" emissive="#fff1d6" emissiveIntensity={2} />
	</T.Mesh>
	<T.Mesh position={[0, 0.052, 0]} geometry={cyl(0.01, 0.01, 0.006, 16)} material={bright} />
	<T is={lamp} position={[0, 0.06, 0]} />
</T.Group>

<!-- Drive unit: rollers grip the arm and feed it in and out -->
<T.Group position={[DRIVE, ex[1], ex[2]]}>
	<T.Mesh position={[0, 0, 0]} geometry={rbox(0.36, 0.3, 0.3, 0.04)} material={paint} castShadow />
	<T.Mesh
		position={[0.19, 0, 0]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.06, 0.07, 0.04, 24)}
		material={castBlack}
	/>
	<T.Mesh
		position={[0, 0.19, 0]}
		geometry={cyl(0.08, 0.08, 0.08, 24)}
		material={castBlack}
		castShadow
	/>
	<T.Mesh
		position={[0, 0, -(ex[2] - 0.15) / 2 - 0.15]}
		geometry={rbox(0.1, 0.1, ex[2] - 0.15, 0.01)}
		material={structure}
		castShadow
	/>
	<T.Mesh
		position={[0, 0, -ex[2] + 0.015]}
		geometry={rbox(0.4, 0.4, 0.03, 0.005)}
		material={darkPaint}
	/>
</T.Group>

<!-- Storage drum with the rest of the arm wound on it -->
<T.Group position={[DRIVE - 0.75, ex[1], 0.62]}>
	<T.Mesh
		geometry={cyl(0.4, 0.4, 0.04, 40)}
		position={[0, -0.16, 0]}
		material={darkPaint}
		castShadow
	/>
	<T.Mesh
		geometry={cyl(0.4, 0.4, 0.04, 40)}
		position={[0, 0.16, 0]}
		material={darkPaint}
		castShadow
	/>
	<T.Mesh geometry={cyl(0.12, 0.12, 0.34, 24)} material={bright} />
	{#each coils as c (c)}
		<T.Mesh
			position={[0, -0.12 + c * 0.06, 0]}
			rotation.x={Math.PI / 2}
			geometry={torus(0.3, SNAKE.radius)}
			material={paint}
			castShadow
		/>
	{/each}
	{#each [-1, 1] as s (s)}
		<T.Mesh
			position={[0, s * 0.2, -0.31]}
			geometry={rbox(0.12, 0.06, 0.62, 0.01)}
			material={structure}
			castShadow
		/>
	{/each}
	<T.Mesh position={[0, 0, -0.61]} geometry={rbox(0.6, 0.5, 0.03, 0.005)} material={darkPaint} />
</T.Group>
