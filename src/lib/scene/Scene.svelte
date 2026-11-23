<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls, Grid } from '@threlte/extras';
	import { mode } from 'mode-watcher';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import Robot from './Robot.svelte';
	import Fixtures from './Fixtures.svelte';
	import Ply from './Ply.svelte';
	import Sensors from './Sensors.svelte';

	let { sim, view }: { sim: Simulation; view: number } = $props();

	const dark = $derived(mode.current === 'dark');

	// Camera presets in Y-up coordinates (the cell itself is modelled Z-up).
	const views: { position: [number, number, number]; target: [number, number, number] }[] = [
		{ position: [4.6, 3.1, 2.2], target: [0, 0.75, -0.1] },
		{ position: [0.01, 6.2, -0.05], target: [0, 0.6, -0.05] },
		{ position: [0.4, 1.9, -3.6], target: [0, 0.9, -1.0] }
	];
	const preset = $derived(views[view] ?? views[0]);
</script>

<T.PerspectiveCamera makeDefault position={preset.position} fov={38} near={0.05} far={60}>
	<OrbitControls
		target={preset.target}
		enableDamping
		maxPolarAngle={Math.PI / 2 - 0.05}
		minDistance={1.2}
		maxDistance={14}
	/>
</T.PerspectiveCamera>

<T.HemisphereLight
	args={[dark ? '#d9d2c5' : '#fffaf0', dark ? '#1d1b19' : '#b8afa0', dark ? 1.1 : 1.4]}
/>
<T.DirectionalLight
	position={[3.5, 7, 2.5]}
	intensity={dark ? 1.8 : 2.2}
	castShadow
	shadow.mapSize={[2048, 2048]}
	shadow.camera.left={-4}
	shadow.camera.right={4}
	shadow.camera.top={4}
	shadow.camera.bottom={-4}
	shadow.bias={-0.0004}
/>

<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.001} receiveShadow>
	<T.PlaneGeometry args={[40, 40]} />
	<T.ShadowMaterial opacity={dark ? 0.45 : 0.22} />
</T.Mesh>
<Grid
	cellColor={dark ? '#34312d' : '#d8d1c4'}
	sectionColor={dark ? '#4a4540' : '#bfb6a6'}
	cellSize={0.25}
	sectionSize={1}
	gridSize={[24, 24]}
	fadeDistance={16}
/>

<!-- Everything below is modelled Z-up; this turns it Y-up for three.js. -->
<T.Group rotation.x={-Math.PI / 2}>
	<Fixtures mould={sim.config.mould} />
	<Robot {sim} />
	{#each sim.plies as ply (ply.index + ':' + ply.angle + ':' + sim.config.seed)}
		<Ply {sim} index={ply.index} />
	{/each}
	<Sensors {sim} />
</T.Group>
