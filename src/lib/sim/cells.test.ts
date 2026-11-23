import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { inverse, toolPose, HOME } from './robot.js';
import { checkPlan, fieldFor, poseAt, Reach, LEVELS } from './reach.svelte.js';
import { labyrinth } from './reach/levels.js';
import { slots, Stack, STANDBY_Q, CONVEYOR } from './stack.svelte.js';
import { TandemCore, DEFAULT_TANDEM, STRATEGIES } from './tandem.svelte.js';

describe('reach', () => {
	it('plans the first three work points of every structure within its default limit', () => {
		for (const make of LEVELS) {
			const level = make();
			for (let i = 0; i < 3; i++)
				expect(checkPlan(level, i, level.bendLimit).problem, `${level.name} ${i}`).toBeNull();
		}
	});

	it('never routes through the structure', () => {
		for (const make of LEVELS) {
			const level = make();
			level.targets.forEach((_, i) => {
				const plan = checkPlan(level, i, 90);
				expect(plan.path, `${level.name} ${i}`).not.toBeNull();
				expect(plan.minClearance, `${level.name} ${i}`).toBeGreaterThanOrEqual(0);
			});
		}
	});

	it('keeps the link length between joints', () => {
		const level = LEVELS[2]();
		const plan = checkPlan(level, 1, level.bendLimit);
		const pose = poseAt(plan.path!, plan.path!.length, level.links, level.link, fieldFor(level));
		for (let i = 1; i < pose.joints.length; i++)
			expect(pose.joints[i].distanceTo(pose.joints[i - 1])).toBeLessThanOrEqual(level.link + 1e-6);
	});

	it('generates a different labyrinth for each seed, and the same one for the same seed', () => {
		const a = labyrinth(3).solids.length + JSON.stringify(labyrinth(3).targets);
		const b = labyrinth(3).solids.length + JSON.stringify(labyrinth(3).targets);
		const c = JSON.stringify(labyrinth(4).targets);
		expect(a).toBe(b);
		expect(c).not.toBe(JSON.stringify(labyrinth(3).targets));
	});

	it('reaches a work point, then re-routes to another', () => {
		const r = new Reach();
		r.setLevel(0);
		r.go();
		for (let i = 0; i < 4000 && r.status !== 'arrived'; i++) r.tick(0.05);
		expect(r.status).toBe('arrived');
		r.aim(2);
		r.go();
		for (let i = 0; i < 6000 && (r.status !== 'arrived' || r.visits < 2); i++) r.tick(0.05);
		expect(r.visits).toBe(2);
		const goal = new Vector3(...r.level.targets[2].p);
		expect(r.pose.joints[0].distanceTo(goal)).toBeLessThan(0.01);
	});
});

describe('stack', () => {
	it('can reach every pallet slot and both ends of the pick window', () => {
		for (const p of ['column', 'brick', 'interlocked'] as const)
			for (const s of slots(p)) {
				const along = new Vector3(-Math.sin(s.yaw), Math.cos(s.yaw), 0);
				const pose = toolPose(new Vector3(s.x, s.y, s.z + 0.065), new Vector3(0, 0, -1), along);
				expect(inverse(pose, 0, STANDBY_Q)).not.toBeNull();
			}
		for (const x of [CONVEYOR.pickMin, CONVEYOR.pickMax]) {
			const pose = toolPose(
				new Vector3(x, CONVEYOR.y, CONVEYOR.top + 0.13),
				new Vector3(0, 0, -1),
				new Vector3(0, 1, 0)
			);
			expect(inverse(pose, 0, HOME)).not.toBeNull();
		}
	});

	for (const mode of ['fly', 'stop'] as const) {
		it(`fills a pallet picking ${mode === 'fly' ? 'on the fly' : 'with the conveyor stopped'}`, () => {
			const s = new Stack();
			s.configure({ mode, rate: 6 });
			s.warp = 1;
			s.start();
			for (let i = 0; i < 100000 && s.status === 'running'; i++) s.tick(0.05);
			expect(s.status).toBe('done');
			expect(s.stacked).toBe(s.capacity);
		});
	}
});

describe('tandem', () => {
	it('places every ply under every strategy without the bridges meeting', () => {
		for (const s of STRATEGIES) {
			const core = new TandemCore({ ...DEFAULT_TANDEM, strategy: s.id });
			let closest = Infinity;
			for (let k = 0; k < 400000 && !core.done; k++) {
				core.step(0.02);
				closest = Math.min(closest, core.gantries[1].pos[0] - core.gantries[0].pos[0]);
			}
			expect(core.done, s.id).toBe(true);
			expect(core.plies.every((p) => p.state === 'placed')).toBe(true);
			expect(closest, s.id).toBeGreaterThan(0.8);
		}
	});

	it('two gantries beat one', () => {
		const one = new TandemCore({ ...DEFAULT_TANDEM, strategy: 'single' }).runToEnd();
		const two = new TandemCore({ ...DEFAULT_TANDEM, strategy: 'shared' }).runToEnd();
		expect(two).toBeLessThan(one * 0.75);
	});
});
