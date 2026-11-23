<script lang="ts">
	/** The snake arm: instanced links and joints, coloured by clearance, plus its feed carriage. */
	import { T, useTask } from '@threlte/core';
	import {
		Color,
		CylinderGeometry,
		InstancedMesh,
		Matrix4,
		MeshStandardMaterial,
		Quaternion,
		SphereGeometry,
		Vector3
	} from 'three';
	import { onDestroy } from 'svelte';
	import { SNAKE, type Reach } from '#lib/sim/reach.svelte.js';
	import { castBlack, darkPaint, paint } from '../common/materials';
	import { cyl, rbox } from '../common/shapes';

	let { sim }: { sim: Reach } = $props();

	const N = SNAKE.links;
	const linkMat = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 });
	const links = new InstancedMesh(
		new CylinderGeometry(SNAKE.radius, SNAKE.radius, 1, 16),
		linkMat,
		N
	);
	const joints = new InstancedMesh(
		new SphereGeometry(SNAKE.radius * 1.12, 14, 10),
		new MeshStandardMaterial({ color: '#2d2b28', roughness: 0.6 }),
		N + 1
	);
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
	let base = $state<[number, number, number]>([0, 0, 0]);
	let tip = $state<[number, number, number]>([0, 0, 0]);
	let tipQ = $state<[number, number, number, number]>([0, 0, 0, 1]);

	useTask(
		() => {
			const { joints: js, clearance } = sim.pose;
			for (let i = 0; i < N; i++) {
				dir.subVectors(js[i], js[i + 1]);
				const len = dir.length();
				q.setFromUnitVectors(up, dir.normalize());
				mid.addVectors(js[i], js[i + 1]).multiplyScalar(0.5);
				m.compose(mid, q, new Vector3(1, Math.max(len, 1e-4), 1));
				links.setMatrixAt(i, m);
				links.setColorAt(i, clearance[i] < 8 ? tight : ok);
			}
			for (let i = 0; i <= N; i++) joints.setMatrixAt(i, m.compose(js[i], q.identity(), one));
			links.instanceMatrix.needsUpdate = true;
			if (links.instanceColor) links.instanceColor.needsUpdate = true;
			joints.instanceMatrix.needsUpdate = true;
			const b = js[N];
			base = [b.x, b.y, b.z];
			tip = [js[0].x, js[0].y, js[0].z];
			dir.subVectors(js[0], js[1]).normalize();
			q.setFromUnitVectors(up, dir);
			tipQ = [q.x, q.y, q.z, q.w];
		},
		{ after: 'simulation' }
	);

	onDestroy(() => {
		links.geometry.dispose();
		joints.geometry.dispose();
	});
</script>

<T is={links} />
<T is={joints} />

<!-- Tool head: camera and lamp on the tip -->
<T.Group position={tip} quaternion={tipQ}>
	<T.Mesh position={[0, 0.03, 0]} material={darkPaint}>
		<T.CylinderGeometry args={[0.024, 0.03, 0.06, 16]} />
	</T.Mesh>
	<T.Mesh position={[0, 0.065, 0]}>
		<T.CylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
		<T.MeshStandardMaterial color="#cfe8ff" emissive="#9fd3ff" emissiveIntensity={1.5} />
	</T.Mesh>
</T.Group>

<!-- Feed unit: carriage on the rail, drive housing holding the arm's base, cable bundle out the back -->
<T.Group position={[base[0], 0, 0]}>
	<T.Mesh
		position={[-0.2, 0, base[2]]}
		geometry={rbox(0.4, 0.26, 0.26, 0.04)}
		material={paint}
		castShadow
	/>
	<T.Mesh
		position={[-0.2, 0.16, base[2]]}
		geometry={rbox(0.24, 0.06, 0.18, 0.02)}
		material={castBlack}
	/>
	<T.Mesh
		position={[-0.42, 0, base[2]]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.07, 0.07, 0.06, 24)}
		material={castBlack}
		castShadow
	/>
	<T.Mesh
		position={[0.01, 0, base[2]]}
		rotation.z={Math.PI / 2}
		geometry={cyl(0.045, 0.06, 0.04, 24)}
		material={castBlack}
	/>
	<T.Mesh
		position={[-0.2, 0, (0.47 + base[2] - 0.13) / 2]}
		geometry={rbox(0.08, 0.08, Math.max(0.02, base[2] - 0.13 - 0.47), 0.008)}
		material={darkPaint}
		castShadow
	/>
	<T.Mesh
		position={[-0.2, 0, 0.49]}
		geometry={rbox(0.36, 0.22, 0.05, 0.01)}
		material={darkPaint}
		castShadow
	/>
</T.Group>
