<script lang="ts">
	/**
	 * The two sensors: the kit camera's field of view while it locates a ply,
	 * and the laser line that sweeps each placed ply for inspection.
	 */
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
	import { onDestroy } from 'svelte';
	import { KIT, MOULD, PLY, placePose, rayToMould } from '#lib/sim/cell.js';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { fan, frustum, laser } from '../common/materials';

	let { sim }: { sim: Simulation } = $props();

	const camera = new Vector3(0, KIT.y - 0.26, 2.05);
	const scanner = new Vector3(0, MOULD.y + 0.36, 2.05);

	function buffer(count: number) {
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
		return g;
	}

	// Frustum: four triangles from the camera to the ply's footprint.
	const view = buffer(12);
	// Laser line as a thin ribbon across the ply, plus its fan back to the scanner.
	const SEG = 16;
	const line = buffer(SEG * 6);
	const sheet = buffer(SEG * 3);

	let locating = $state(false);
	let scanning = $state(false);

	const p = new Vector3();
	const ax = new Vector3();
	const ay = new Vector3();
	const az = new Vector3();

	function write(g: BufferGeometry, points: Vector3[]) {
		const attr = g.getAttribute('position') as BufferAttribute;
		points.forEach((v, i) => attr.setXYZ(i, v.x, v.y, v.z));
		attr.needsUpdate = true;
		g.computeBoundingSphere();
	}

	useTask(
		() => {
			locating = sim.phase === 'Locate ply' && sim.current >= 0;
			if (locating) {
				const x = sim.stationXs[sim.plies[sim.current].station];
				const hx = PLY.length / 2 + 0.05;
				const hy = PLY.width / 2 + 0.05;
				const z = KIT.top + 0.003;
				const c = [
					new Vector3(x - hx, KIT.y - hy, z),
					new Vector3(x + hx, KIT.y - hy, z),
					new Vector3(x + hx, KIT.y + hy, z),
					new Vector3(x - hx, KIT.y + hy, z)
				];
				write(
					view,
					[0, 1, 2, 3].flatMap((i) => [camera, c[i], c[(i + 1) % 4]])
				);
			}

			const scan = sim.scan;
			scanning = scan !== null;
			if (scan) {
				const ply = sim.plies[scan.ply];
				const x = sim.stationXs[ply.station];
				const pose = placePose(sim.config.mould, x);
				const origin = new Vector3().setFromMatrixPosition(pose);
				pose.extractBasis(ax, ay, az);
				const u = -PLY.length / 2 - 0.02 + scan.progress * (PLY.length + 0.04);
				const half = PLY.width / 2 + 0.03;
				const pts: Vector3[] = [];
				for (let i = 0; i <= SEG; i++) {
					const v = -half + (2 * half * i) / SEG;
					p.copy(origin).addScaledVector(ay, u).addScaledVector(az, v);
					p.addScaledVector(ax, rayToMould(sim.config.mould, p, ax) - 0.004);
					pts.push(p.clone());
				}
				const w = 0.0025;
				const ribbon: Vector3[] = [];
				const fanTris: Vector3[] = [];
				for (let i = 0; i < SEG; i++) {
					const a0 = pts[i].clone().addScaledVector(ay, -w);
					const a1 = pts[i].clone().addScaledVector(ay, w);
					const b0 = pts[i + 1].clone().addScaledVector(ay, -w);
					const b1 = pts[i + 1].clone().addScaledVector(ay, w);
					ribbon.push(a0, b0, a1, a1, b0, b1);
					fanTris.push(scanner, pts[i], pts[i + 1]);
				}
				write(line, ribbon);
				write(sheet, fanTris);
			}
		},
		{ after: 'simulation' }
	);

	onDestroy(() => {
		view.dispose();
		line.dispose();
		sheet.dispose();
	});
</script>

<T.Mesh geometry={view} material={frustum} visible={locating} frustumCulled={false} />
<T.Mesh geometry={line} material={laser} visible={scanning} frustumCulled={false} />
<T.Mesh geometry={sheet} material={fan} visible={scanning} frustumCulled={false} />
