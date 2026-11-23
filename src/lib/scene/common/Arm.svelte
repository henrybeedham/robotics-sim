<script lang="ts">
	/**
	 * The six-axis arm from `#lib/sim/robot`, drawn Z-up. Its pose is pulled from
	 * `source` every frame. The tool snippet is drawn in the TCP frame (+X is the
	 * approach direction). The frames match `forward()` exactly; everything else
	 * here is appearance.
	 */
	import type { Snippet } from 'svelte';
	import { T, useTask } from '@threlte/core';
	import { CatmullRomCurve3, TubeGeometry, Vector3, type Material } from 'three';
	import { ARM, HOME, type Joints } from '#lib/sim/robot.js';
	import { paint as amber, bright, cable, castBlack, darkPaint } from './materials';
	import { cyl, rbox } from './shapes';

	let {
		source,
		paint = amber,
		tool
	}: {
		source: { q: Joints; rail: number };
		paint?: Material;
		tool?: Snippet;
	} = $props();

	let q = $state.raw<Joints>([...HOME]);
	let rail = $state(0);

	useTask(
		() => {
			q = source.q;
			rail = source.rail;
		},
		{ after: 'simulation' }
	);

	const h = Math.PI / 2;
	const { a1, a2, a3, d1, d6 } = ARM;

	// Cable harness down the side of the upper arm, then over the elbow.
	const harness = new TubeGeometry(
		new CatmullRomCurve3([
			new Vector3(-0.05, -0.2, 0.02),
			new Vector3(-0.11, -0.17, a2 * 0.3),
			new Vector3(-0.11, -0.17, a2 * 0.7),
			new Vector3(-0.06, -0.19, a2 - 0.05)
		]),
		24,
		0.018,
		8
	);
	const bolts = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
</script>

<T.Group position.x={rail}>
	<!-- Base: bolted plate, then the fixed pedestal casting -->
	<T.Mesh
		position={[0, 0, 0.13]}
		geometry={rbox(0.64, 0.58, 0.06, 0.015)}
		material={darkPaint}
		castShadow
	/>
	{#each [-1, 1] as sx (sx)}
		{#each [-1, 1] as sy (sy)}
			<T.Mesh
				position={[sx * 0.27, sy * 0.24, 0.17]}
				rotation.x={h}
				geometry={cyl(0.016, 0.016, 0.02, 6)}
				material={bright}
			/>
		{/each}
	{/each}
	<T.Mesh
		position={[0, 0, 0.25]}
		rotation.x={h}
		geometry={cyl(0.2, 0.25, 0.18)}
		material={paint}
		castShadow
	/>
	<T.Mesh
		position={[0, 0, 0.345]}
		rotation.x={h}
		geometry={cyl(0.205, 0.205, 0.012)}
		material={castBlack}
	/>

	<!-- J1 turret -->
	<T.Group rotation.z={q[0]}>
		<T.Mesh
			position={[0, 0, 0.44]}
			rotation.x={h}
			geometry={cyl(0.2, 0.205, 0.17)}
			material={paint}
			castShadow
		/>
		<T.Mesh
			position={[a1 * 0.45, 0, d1 - 0.1]}
			geometry={rbox(0.4, 0.4, 0.26, 0.06)}
			material={paint}
			castShadow
		/>
		<!-- J1 motor at the back of the turret -->
		<T.Mesh
			position={[-0.16, 0, 0.52]}
			rotation.x={h}
			geometry={cyl(0.065, 0.065, 0.16, 24)}
			material={castBlack}
			castShadow
		/>

		<!-- J2 shoulder -->
		<T.Group position={[a1, 0, d1]} rotation.y={q[1]}>
			<!-- Joint hub and its two caps -->
			<T.Mesh geometry={cyl(0.165, 0.165, 0.34, 40)} material={paint} castShadow />
			{#each [-1, 1] as s (s)}
				<T.Mesh
					position={[0, s * 0.175, 0]}
					geometry={cyl(0.12, 0.12, 0.02, 40)}
					material={castBlack}
				/>
			{/each}
			<!-- J2 motor on the outside of the hub -->
			<T.Mesh
				position={[0, 0.27, 0]}
				geometry={cyl(0.085, 0.085, 0.2, 28)}
				material={castBlack}
				castShadow
			/>
			<T.Mesh position={[0, 0.375, 0]} geometry={cyl(0.06, 0.06, 0.02, 24)} material={bright} />
			<!-- Upper arm: a deep, rounded casting -->
			<T.Mesh
				position={[0, 0, a2 / 2]}
				geometry={rbox(0.17, 0.22, a2 - 0.05, 0.05)}
				material={paint}
				castShadow
			/>
			<T.Mesh
				position={[0.088, 0, a2 / 2]}
				geometry={rbox(0.012, 0.16, a2 - 0.35, 0.005)}
				material={castBlack}
			/>
			<T.Mesh geometry={harness} material={cable} castShadow />

			<!-- J3 elbow -->
			<T.Group position={[0, 0, a2]} rotation.y={q[2] + h}>
				<T.Mesh geometry={cyl(0.13, 0.13, 0.28, 36)} material={paint} castShadow />
				<T.Mesh
					position={[0, 0.235, 0]}
					geometry={cyl(0.075, 0.075, 0.18, 24)}
					material={castBlack}
					castShadow
				/>
				<!-- Rear housing with the J4–J6 motors behind the elbow -->
				<T.Mesh
					position={[0, 0, -0.14]}
					geometry={rbox(0.25, 0.25, 0.3, 0.06)}
					material={paint}
					castShadow
				/>
				{#each [-0.06, 0.06] as y (y)}
					<T.Mesh
						position={[0.03, y, -0.33]}
						rotation.x={h}
						geometry={cyl(0.045, 0.045, 0.1, 20)}
						material={castBlack}
						castShadow
					/>
				{/each}
				<T.Mesh
					position={[-0.07, 0, -0.33]}
					rotation.x={h}
					geometry={cyl(0.045, 0.045, 0.1, 20)}
					material={castBlack}
					castShadow
				/>
				<!-- Forearm tube, tapering to the wrist -->
				<T.Mesh
					position={[0, 0, a3 / 2 + 0.02]}
					rotation.x={h}
					geometry={cyl(0.07, 0.095, a3 - 0.2, 32)}
					material={paint}
					castShadow
				/>
				<T.Mesh
					position={[0, 0, 0.12]}
					rotation.x={h}
					geometry={cyl(0.1, 0.1, 0.03, 32)}
					material={castBlack}
				/>

				<!-- Spherical wrist: J4, J5, J6 -->
				<T.Group position={[0, 0, a3]} rotation.y={-h}>
					<T.Group rotation.x={q[3]}>
						<T.Mesh
							position={[-0.09, 0, 0]}
							rotation.z={h}
							geometry={cyl(0.08, 0.075, 0.08, 32)}
							material={paint}
							castShadow
						/>
						<!-- Yoke cheeks either side of J5 -->
						{#each [-1, 1] as s (s)}
							<T.Mesh
								position={[-0.01, s * 0.075, 0]}
								geometry={rbox(0.15, 0.03, 0.13, 0.012)}
								material={paint}
								castShadow
							/>
						{/each}
						<T.Group rotation.y={q[4]}>
							<T.Mesh geometry={cyl(0.058, 0.058, 0.12, 28)} material={castBlack} castShadow />
							{#each [-1, 1] as s (s)}
								<T.Mesh
									position={[0, s * 0.093, 0]}
									geometry={cyl(0.04, 0.04, 0.008, 24)}
									material={bright}
								/>
							{/each}
							<T.Mesh
								position={[0.06, 0, 0]}
								rotation.z={h}
								geometry={cyl(0.052, 0.058, 0.06, 28)}
								material={paint}
								castShadow
							/>
							<T.Group rotation.x={q[5]}>
								<!-- Tool flange with its bolt circle -->
								<T.Mesh
									position={[d6 - 0.012, 0, 0]}
									rotation.z={h}
									geometry={cyl(0.058, 0.058, 0.024, 36)}
									material={bright}
									castShadow
								/>
								{#each bolts as a (a)}
									<T.Mesh
										position={[d6 + 0.001, Math.cos(a) * 0.044, Math.sin(a) * 0.044]}
										rotation.z={h}
										geometry={cyl(0.005, 0.005, 0.006, 6)}
										material={castBlack}
									/>
								{/each}
								<T.Group position={[d6 + ARM.tool, 0, 0]}>
									{@render tool?.()}
								</T.Group>
							</T.Group>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>
		</T.Group>
	</T.Group>
</T.Group>
