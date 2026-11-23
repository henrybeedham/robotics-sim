<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from 'three';
	import type { Reach } from '#lib/sim/reach.svelte.js';
	import { BOX } from '#lib/sim/reach.svelte.js';
	import Stage, { type CameraView } from '../common/Stage.svelte';
	import WingBox from './WingBox.svelte';
	import Snake from './Snake.svelte';

	let {
		sim,
		view = 0,
		demo = false,
		showTop = true
	}: { sim: Reach; view?: number; demo?: boolean; showTop?: boolean } = $props();

	const views: CameraView[] = [
		{ position: [-1.4, 2.9, 2.7], target: [1.2, 0.85, 0] },
		{ position: [1.3, 5.2, 0.01], target: [1.3, 0.8, 0] },
		{ position: [1.3, 1.1, 3.4], target: [1.3, 0.9, 0] }
	];

	// Planned route, drawn as a thin line ahead of the arm.
	const line = new BufferGeometry();
	const lineMat = new LineBasicMaterial({ color: '#d4861f', transparent: true, opacity: 0.8 });
	$effect(() => {
		const pts = sim.plan.path.points;
		line.setAttribute(
			'position',
			new Float32BufferAttribute(
				pts.flatMap((p) => [p.x, p.y, p.z]),
				3
			)
		);
		line.computeBoundingSphere();
		lineMat.color.set(sim.plan.problem ? '#d8402a' : '#d4861f');
	});
</script>

<Stage {views} {view} {demo}>
	<WingBox {showTop} />
	<Snake {sim} />
	<T.Line geometry={line} material={lineMat} frustumCulled={false} />
	<!-- Work point on the lower skin -->
	<T.Mesh position={[sim.target.x, sim.target.y, BOX.z0 + 0.002]}>
		<T.RingGeometry args={[0.025, 0.035, 32]} />
		<T.MeshBasicMaterial color={sim.plan.problem ? '#d8402a' : '#d4861f'} />
	</T.Mesh>
</Stage>
