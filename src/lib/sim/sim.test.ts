import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { forward, inverse, HOME, type Joints } from './robot.js';
import {
	MOULDS,
	kitPose,
	placePose,
	standOff,
	stationXs,
	conformProfile,
	cornerDeviation
} from './cell.js';
import { Simulation } from './engine.svelte.js';

const close = (a: Matrix4, b: Matrix4, eps = 1e-6) =>
	a.elements.every((v, i) => Math.abs(v - b.elements[i]) < eps);

describe('kinematics', () => {
	it('inverse undoes forward across the workspace', () => {
		const samples: Joints[] = [
			[0.3, 0.2, -0.4, 0.5, 1.0, -0.7],
			[-1.4, 0.5, -0.1, -1.2, 0.6, 2.0],
			[2.2, -0.2, -0.8, 0.1, -0.9, 0.3]
		];
		for (const q of samples) {
			const { tcp } = forward(q, 0.4);
			const solved = inverse(tcp, 0.4, q);
			expect(solved).not.toBeNull();
			expect(close(forward(solved!, 0.4).tcp, tcp)).toBe(true);
		}
	});

	it('reaches every kit and mould target for every mould', () => {
		for (const { id } of MOULDS) {
			for (const x of stationXs(3)) {
				for (const pose of [kitPose(x), placePose(id, x), standOff(placePose(id, x), 0.2)]) {
					const q = inverse(pose, x, HOME);
					expect(q, `${id} at ${x}`).not.toBeNull();
					expect(close(forward(q!, x).tcp, pose)).toBe(true);
				}
			}
		}
	});

	it('returns null for an unreachable pose', () => {
		const far = new Matrix4().makeTranslation(0, 4, 1);
		expect(inverse(far, 0)).toBeNull();
	});
});

describe('cell', () => {
	it('conform profile is zero at the centre and touches the surface', () => {
		const pose = placePose('saddle', 0.68);
		const profile = conformProfile('saddle', pose);
		expect(Math.abs(profile(0, 0))).toBeLessThan(1e-6);
		expect(Math.abs(profile(0, 0.17))).toBeGreaterThan(0.001);
	});

	it('measures a pure shift as the corner deviation', () => {
		expect(cornerDeviation({ u: 0.003, v: 0.004, theta: 0 })).toBeCloseTo(0.005, 9);
	});

	it('kit pose points straight down', () => {
		const x = new Vector3();
		kitPose(0).extractBasis(x, new Vector3(), new Vector3());
		expect(x.z).toBeCloseTo(-1);
	});
});

function run(vision: boolean) {
	const sim = new Simulation();
	sim.configure({ vision, layers: [0, 45, -45, 90], seed: 7 });
	sim.warp = 1;
	sim.start();
	for (let i = 0; i < 20000 && sim.status === 'running'; i++) sim.tick(0.05);
	return sim;
}

describe('simulation', () => {
	it('lays and inspects every ply', () => {
		const sim = run(true);
		expect(sim.error ?? sim.status).toBe('done');
		expect(sim.results.inspected).toBe(12);
		expect(sim.results.meanCycle).toBeGreaterThan(3);
		expect(sim.results.meanCycle).toBeLessThan(20);
	});

	it('vision-guided picking places plies more accurately', () => {
		const withVision = run(true).results;
		const blind = run(false).results;
		expect(withVision.meanDeviation!).toBeLessThan(blind.meanDeviation!);
		expect(withVision.passed).toBeGreaterThan(blind.passed);
	});
});
