<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { ARM, HOME, RAIL, type Joints } from '#lib/sim/robot.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { paint, darkPaint, steel } from './materials';
	import Gripper from './Gripper.svelte';

	let { sim }: { sim: Simulation } = $props();

	let q = $state.raw<Joints>([...HOME]);
	let rail = $state(0);

	useTask(
		() => {
			q = sim.q;
			rail = sim.rail;
		},
		{ after: 'simulation' }
	);

	const railLength = RAIL.max - RAIL.min + 0.8;
	const h = Math.PI / 2;
</script>

<!-- Linear rail on the floor -->
{#each [-0.17, 0.17] as y (y)}
	<T.Mesh position={[0, y, 0.05]} material={steel} castShadow receiveShadow>
		<T.BoxGeometry args={[railLength, 0.07, 0.1]} />
	</T.Mesh>
{/each}
<T.Mesh position={[0, 0, 0.02]} material={darkPaint} receiveShadow>
	<T.BoxGeometry args={[railLength, 0.5, 0.04]} />
</T.Mesh>

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
									<Gripper {sim} />
								</T.Group>
							</T.Group>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>
		</T.Group>
	</T.Group>
</T.Group>
