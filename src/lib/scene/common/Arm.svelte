<script lang="ts">
	/**
	 * The six-axis arm from `#lib/sim/robot`, drawn Z-up. Its pose is pulled from
	 * `source` every frame. The tool snippet is drawn in the TCP frame (+X is the
	 * approach direction).
	 */
	import type { Snippet } from 'svelte';
	import { T, useTask } from '@threlte/core';
	import type { Material } from 'three';
	import { ARM, HOME, type Joints } from '#lib/sim/robot.js';
	import { paint as amber, darkPaint, steel } from './materials';

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
</script>

<T.Group position.x={rail}>
	<!-- Carriage and riser -->
	<T.Mesh position={[0, 0, 0.14]} material={darkPaint} castShadow>
		<T.BoxGeometry args={[0.62, 0.56, 0.1]} />
	</T.Mesh>
	<T.Mesh position={[0, 0, 0.32]} rotation.x={h} material={paint} castShadow>
		<T.CylinderGeometry args={[0.2, 0.24, 0.28, 32]} />
	</T.Mesh>

	<!-- J1 turret -->
	<T.Group rotation.z={q[0]}>
		<T.Mesh position={[0.05, 0, 0.58]} rotation.x={h} material={paint} castShadow>
			<T.CylinderGeometry args={[0.22, 0.22, 0.24, 32]} />
		</T.Mesh>
		<T.Mesh position={[ARM.a1 * 0.6, 0, ARM.d1 - 0.04]} material={paint} castShadow>
			<T.BoxGeometry args={[0.34, 0.36, 0.2]} />
		</T.Mesh>

		<!-- J2 shoulder -->
		<T.Group position={[ARM.a1, 0, ARM.d1]} rotation.y={q[1]}>
			<T.Mesh position={[0, -0.18, 0]} material={darkPaint} castShadow>
				<T.CylinderGeometry args={[0.15, 0.15, 0.14, 32]} />
			</T.Mesh>
			<T.Mesh position={[0, 0, ARM.a2 / 2]} material={paint} castShadow>
				<T.BoxGeometry args={[0.17, 0.22, ARM.a2 + 0.12]} />
			</T.Mesh>

			<!-- J3 elbow -->
			<T.Group position={[0, 0, ARM.a2]} rotation.y={q[2] + h}>
				<T.Mesh position={[0, 0.16, 0]} material={darkPaint} castShadow>
					<T.CylinderGeometry args={[0.12, 0.12, 0.1, 32]} />
				</T.Mesh>
				<T.Mesh position={[0, 0, -0.12]} material={paint} castShadow>
					<T.BoxGeometry args={[0.24, 0.24, 0.32]} />
				</T.Mesh>
				<T.Mesh position={[0, 0, ARM.a3 / 2]} rotation.x={h} material={paint} castShadow>
					<T.CylinderGeometry args={[0.075, 0.1, ARM.a3 - 0.1, 24]} />
				</T.Mesh>

				<!-- Spherical wrist: J4, J5, J6 -->
				<T.Group position={[0, 0, ARM.a3]} rotation.y={-h}>
					<T.Group rotation.x={q[3]}>
						<T.Mesh position={[-0.06, 0, 0]} rotation.z={h} material={paint} castShadow>
							<T.CylinderGeometry args={[0.085, 0.085, 0.12, 24]} />
						</T.Mesh>
						<T.Group rotation.y={q[4]}>
							<T.Mesh material={darkPaint} castShadow>
								<T.CylinderGeometry args={[0.07, 0.07, 0.17, 24]} />
							</T.Mesh>
							<T.Group rotation.x={q[5]}>
								<T.Mesh position={[ARM.d6 - 0.02, 0, 0]} rotation.z={h} material={steel} castShadow>
									<T.CylinderGeometry args={[0.06, 0.06, 0.04, 24]} />
								</T.Mesh>
								<T.Group position={[ARM.d6 + ARM.tool, 0, 0]}>
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
