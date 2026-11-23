<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from 'three';
	import type { Reach } from '#lib/sim/reach.svelte.js';
	import Stage, { type CameraView } from '../common/Stage.svelte';
	import Structure from './Structure.svelte';
	import Snake from './Snake.svelte';

	let {
		sim,
		view = 0,
		demo = false,
		seeThrough = true
	}: { sim: Reach; view?: number; demo?: boolean; seeThrough?: boolean } = $props();

	// Presets framed on the structure's bounds. Z-up (x, y, z) is (x, z, -y) here.
	const views = $derived.by((): CameraView[] => {
		const { min, max } = sim.level;
		const c = [(min[0] + max[0]) / 2 - 0.4, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
		const span = Math.max(max[0] - min[0], (max[1] - min[1]) * 1.6, 2.2);
		return [
			{
				position: [c[0] - 0.55 * span, c[2] + 0.75 * span, 0.85 * span - c[1]],
				target: [c[0] + 0.2, c[2] - 0.1, -c[1]]
			},
			{
				position: [c[0] + 0.3, c[2] + 1.35 * span, -c[1] + 0.01],
				target: [c[0] + 0.3, c[2], -c[1]]
			},
			{ position: [c[0] + 0.3, c[2] + 0.15, 1.15 * span - c[1]], target: [c[0] + 0.3, c[2], -c[1]] }
		];
	});

	// Planned route, drawn as a thin line ahead of the arm.
	const line = new BufferGeometry();
	const lineMat = new LineBasicMaterial({ color: '#d4861f', transparent: true, opacity: 0.85 });
	$effect(() => {
		const pts = sim.plan?.path?.points ?? [];
		line.setAttribute(
			'position',
			new Float32BufferAttribute(
				pts.flatMap((p) => [p.x, p.y, p.z]),
				3
			)
		);
		line.computeBoundingSphere();
		lineMat.color.set(sim.plan?.problem ? '#d8402a' : '#d4861f');
	});

	const target = $derived(sim.level.targets[sim.target]?.p ?? [0, 0, 0]);
</script>

<Stage {views} {view} {demo} extent={4} follow={{ view: 3, pose: () => sim.tipPose() }}>
	{#key sim.version}
		<Structure level={sim.level} {seeThrough} />
		<Snake {sim} />
	{/key}
	<T.Line geometry={line} material={lineMat} frustumCulled={false} />
	<!-- Work points; the chosen one is ringed -->
	{#each sim.level.targets as t, i (i)}
		<T.Mesh position={t.p}>
			<T.SphereGeometry args={[i === sim.target ? 0.022 : 0.012, 16, 12]} />
			<T.MeshBasicMaterial
				color={i === sim.target ? (sim.plan?.problem ? '#d8402a' : '#ffb347') : '#8a857c'}
			/>
		</T.Mesh>
	{/each}
	<T.Mesh position={target}>
		<T.TorusGeometry args={[0.045, 0.004, 8, 32]} />
		<T.MeshBasicMaterial color={sim.plan?.problem ? '#d8402a' : '#ffb347'} />
	</T.Mesh>
</Stage>
