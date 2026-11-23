<script lang="ts" module>
	export interface CameraView {
		position: [number, number, number];
		target: [number, number, number];
	}
</script>

<script lang="ts">
	/**
	 * Camera, lights and floor shared by every cell. Children are modelled Z-up in
	 * metres and turned Y-up here. In demo mode the camera turns slowly on its own
	 * and the visitor cannot move it.
	 */
	import type { Snippet } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Fog, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';
	import { dressShared } from './materials';
	import { concrete } from './textures';
	import { OrbitControls } from '@threlte/extras';
	import { mode } from 'mode-watcher';
	import Environment from './Environment.svelte';

	let {
		views,
		view = 0,
		demo = false,
		extent = 4,
		follow,
		children
	}: {
		views: CameraView[];
		view?: number;
		demo?: boolean;
		/** Half-width of the area that casts shadows, metres. */
		extent?: number;
		/**
		 * A first-person view: when `view` equals `follow.view`, the camera rides
		 * on whatever `follow.pose()` returns (Z-up position and heading).
		 */
		follow?: { view: number; pose: () => { pos: Vector3; dir: Vector3 } | null };
		children: Snippet;
	} = $props();

	const following = $derived(follow !== undefined && view === follow.view);
	const rider = new PerspectiveCamera(72, 1, 0.004, 40);
	const eye = new Vector3();
	const ahead = new Vector3();
	useTask(
		() => {
			if (!following || !follow) return;
			const p = follow.pose();
			if (!p) return;
			// Z-up model space to three.js Y-up: (x, y, z) -> (x, z, -y).
			eye.set(p.pos.x, p.pos.z, -p.pos.y);
			ahead.set(p.pos.x + p.dir.x, p.pos.z + p.dir.z, -(p.pos.y + p.dir.y));
			eye.lerp(ahead, 0.06);
			rider.position.copy(eye);
			rider.up.set(0, 1, 0);
			if (Math.abs(p.dir.z) > 0.97) rider.up.set(1, 0, 0);
			rider.lookAt(ahead);
		},
		{ after: 'simulation' }
	);

	const dark = $derived(mode.current === 'dark');
	const { size, scene } = useThrelte();

	dressShared();

	// Concrete floor: one texture tile per 2 m, fading into the page with fog.
	const FLOOR = 80;
	const floor = new MeshStandardMaterial({
		map: concrete('colour'),
		roughnessMap: concrete('rough'),
		bumpMap: concrete('bump'),
		bumpScale: 0.6
	});
	for (const t of [floor.map, floor.roughnessMap, floor.bumpMap])
		t?.repeat.set(FLOOR / 2, FLOOR / 2);
	$effect(() => {
		floor.color.set(dark ? '#55504a' : '#d9d3c8');
		// Match the page's --scene-bg so the floor's edge disappears.
		scene.fog = new Fog(dark ? '#1d1b19' : '#efebe3', 14, 38);
		return () => {
			scene.fog = null;
		};
	});

	const preset = $derived.by(() => {
		const v = views[view] ?? views[0];
		// Portrait screens see less width, so pull the camera back to keep the whole cell in frame.
		const aspect = $size.width / Math.max($size.height, 1);
		const k = aspect < 1 ? Math.min(1.9, 1 / aspect + 0.15) : 1;
		const position = v.position.map((p, i) => v.target[i] + (p - v.target[i]) * k) as [
			number,
			number,
			number
		];
		return { position, target: v.target };
	});
</script>

{#if following}
	<T is={rider} makeDefault />
{:else}
	<T.PerspectiveCamera makeDefault position={preset.position} fov={38} near={0.05} far={80}>
		<OrbitControls
			target={preset.target}
			enableDamping
			enabled={!demo}
			autoRotate={demo}
			autoRotateSpeed={0.6}
			maxPolarAngle={Math.PI / 2 - 0.05}
			minDistance={1}
			maxDistance={20}
		/>
	</T.PerspectiveCamera>
{/if}

<Environment intensity={dark ? 0.35 : 0.5} />
<T.HemisphereLight
	args={[dark ? '#d9d2c5' : '#fffaf0', dark ? '#1d1b19' : '#b8afa0', dark ? 0.7 : 0.9]}
/>
<T.DirectionalLight
	position={[3.5, 7, 2.5]}
	intensity={dark ? 1.8 : 2.2}
	castShadow={!demo}
	shadow.mapSize={[2048, 2048]}
	shadow.camera.left={-extent}
	shadow.camera.right={extent}
	shadow.camera.top={extent}
	shadow.camera.bottom={-extent}
	shadow.camera.far={30}
	shadow.bias={-0.0004}
/>

<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.001} receiveShadow material={floor}>
	<T.PlaneGeometry args={[FLOOR, FLOOR]} />
</T.Mesh>

<T.Group rotation.x={-Math.PI / 2}>
	{@render children()}
</T.Group>
