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
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls, Grid } from '@threlte/extras';
	import { mode } from 'mode-watcher';

	let {
		views,
		view = 0,
		demo = false,
		extent = 4,
		children
	}: {
		views: CameraView[];
		view?: number;
		demo?: boolean;
		/** Half-width of the area that casts shadows, metres. */
		extent?: number;
		children: Snippet;
	} = $props();

	const dark = $derived(mode.current === 'dark');
	const { size } = useThrelte();

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

<T.HemisphereLight
	args={[dark ? '#d9d2c5' : '#fffaf0', dark ? '#1d1b19' : '#b8afa0', dark ? 1.1 : 1.4]}
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

<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.001} receiveShadow>
	<T.PlaneGeometry args={[60, 60]} />
	<T.ShadowMaterial opacity={dark ? 0.45 : 0.22} />
</T.Mesh>
<Grid
	cellColor={dark ? '#34312d' : '#d8d1c4'}
	sectionColor={dark ? '#4a4540' : '#bfb6a6'}
	cellSize={0.25}
	sectionSize={1}
	gridSize={[30, 30]}
	fadeDistance={20}
/>

<T.Group rotation.x={-Math.PI / 2}>
	{@render children()}
</T.Group>
