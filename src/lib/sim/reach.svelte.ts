/**
 * Reach: a follow-the-leader snake arm exploring a choice of structures.
 *
 * The arm is a chain of short rigid links on a linear feed. Every point on its
 * body follows the path its tip has already travelled, so once the tip has
 * threaded an opening the rest of the arm threads it too. The planner
 * (`reach/planner.ts`) finds a smooth route; this module checks it against the
 * bend limit and the arm's length, and plays it back. Z-up, metres.
 */
import { Vector3 } from 'three';
import { LEVELS, type Level } from './reach/levels.js';
import { Field, Path, route } from './reach/planner.js';

export { Path } from './reach/planner.js';
export { LEVELS, type Level } from './reach/levels.js';

export const SNAKE = { radius: 0.026 };

export interface Pose {
	/** Joint centres from the tip (index 0) back to the base. */
	joints: Vector3[];
	/** Bend at each joint between neighbouring links, degrees. */
	bends: number[];
	/** Clearance of each link to the structure, mm (after the arm's radius). */
	clearance: number[];
}

// A plain cache: nothing reactive reads it.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const fields = new Map<string, Field>();
/** The distance field for a level, built once and cached. */
export function fieldFor(level: Level) {
	const k = `${level.id}:${level.seed ?? ''}`;
	let f = fields.get(k);
	if (!f) fields.set(k, (f = new Field(level)));
	return f;
}

/** The arm's shape with its tip at arc length `tip` along `path`. */
export function poseAt(path: Path, tip: number, links: number, link: number, field: Field): Pose {
	const joints: Vector3[] = [];
	for (let i = 0; i <= links; i++) joints.push(path.at(tip - i * link));
	const bends: number[] = [];
	const a = new Vector3();
	const b = new Vector3();
	for (let i = 1; i < links; i++) {
		a.subVectors(joints[i - 1], joints[i]).normalize();
		b.subVectors(joints[i], joints[i + 1]).normalize();
		bends.push((Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI);
	}
	const clearance: number[] = [];
	const m = new Vector3();
	for (let i = 0; i < links; i++) {
		let c = Infinity;
		for (const t of [0, 0.5, 1]) {
			m.copy(joints[i]).lerp(joints[i + 1], t);
			c = Math.min(c, field.at(m.x, m.y, m.z));
		}
		clearance.push((c - SNAKE.radius) * 1000);
	}
	return { joints, bends, clearance };
}

export interface Plan {
	target: number;
	path: Path | null;
	/** Worst bend anywhere along the route, degrees, and how far along it occurs. */
	maxBend: number;
	maxBendAt: number;
	/** Tightest clearance along the route, mm. */
	minClearance: number;
	problem: string | null;
}

/**
 * Check a route for the whole arm. Because every link follows the tip's path,
 * the arm's bends anywhere on the way in are the bends between consecutive
 * link-length chords of the path, so one sweep along it covers every pose.
 */
export function checkPlan(level: Level, target: number, bendLimit: number): Plan {
	const field = fieldFor(level);
	const goal = new Vector3(...level.targets[target].p);
	const { path, problem } = route(level, field, goal, SNAKE.radius);
	if (!path) return { target, path: null, maxBend: 0, maxBendAt: 0, minClearance: 0, problem };
	let maxBend = 0;
	let maxBendAt = 0;
	let minClearance = Infinity;
	const L = level.link;
	const p0 = new Vector3();
	const p1 = new Vector3();
	const p2 = new Vector3();
	const u = new Vector3();
	const v = new Vector3();
	for (let s = 0; s <= path.length; s += 0.01) {
		path.at(s - L, p0);
		path.at(s, p1);
		path.at(Math.min(s + L, path.length), p2);
		if (s + L <= path.length) {
			u.subVectors(p1, p0).normalize();
			v.subVectors(p2, p1).normalize();
			const bend = (Math.acos(Math.min(1, Math.max(-1, u.dot(v)))) * 180) / Math.PI;
			if (bend > maxBend) {
				maxBend = bend;
				maxBendAt = s;
			}
		}
		minClearance = Math.min(minClearance, (field.at(p1.x, p1.y, p1.z) - SNAKE.radius) * 1000);
	}
	let issue: string | null = null;
	if (path.length > level.links * L - 0.05)
		issue = `Too far: the route is ${path.length.toFixed(1)} m and the arm is ${(level.links * L).toFixed(1)} m.`;
	else if (maxBend > bendLimit + 0.05)
		issue = `A joint would bend ${maxBend.toFixed(0)}° at ${maxBendAt.toFixed(1)} m in, over the ${bendLimit}° limit.`;
	else if (minClearance < 0) issue = 'The arm would touch the structure.';
	return { target, path, maxBend, maxBendAt, minClearance, problem: issue };
}

/** Arc length up to which two paths are the same, so a retreat can stop there. */
function sharedLength(a: Path, b: Path) {
	const p = new Vector3();
	const q = new Vector3();
	let shared = 0;
	for (let s = 0; s <= Math.min(a.length, b.length); s += 0.01) {
		if (a.at(s, p).distanceTo(b.at(s, q)) > 0.003) break;
		shared = s;
	}
	return shared;
}

/** A straight stowed path, used before anything is planned. */
function stowedPath(level: Level) {
	const e = new Vector3(...level.entry);
	return new Path([
		e.clone().add(new Vector3(-0.35, 0, 0)),
		e.clone().add(new Vector3(0.06, 0, 0))
	]);
}

export type ReachStatus = 'stowed' | 'advancing' | 'retracting' | 'arrived';

export class Reach {
	levelIndex = $state(0);
	level = $state.raw<Level>(LEVELS[0]());
	bendLimit = $state(LEVELS[0]().bendLimit);
	speed = $state(1);
	target = $state(0);
	plan = $state.raw<Plan | null>(null);
	status = $state<ReachStatus>('stowed');
	tip = $state(0);
	/** Throttled copy of the pose for the panels. */
	readout = $state.raw<Pose>({ joints: [], bends: [], clearance: [] });
	visits = $state(0);
	/** Bumped when the structure changes, so scenes rebuild it. */
	version = $state(0);

	/** The path the arm is physically on, which can differ from `plan` while it retreats. */
	active: Path;
	pose: Pose = { joints: [], bends: [], clearance: [] };
	private goal = 0;
	private pending: Plan | null = null;
	private clock = 0;
	onArrive?: (r: Reach) => void;

	constructor() {
		this.active = stowedPath(this.level);
	}

	get links() {
		return this.level.links;
	}

	get field() {
		return fieldFor(this.level);
	}

	/** Switch structure. The arm is withdrawn first (instantly) and the first work point is planned. */
	setLevel(index: number, seed?: number) {
		this.levelIndex = index;
		this.level = LEVELS[index](seed);
		this.bendLimit = this.level.bendLimit;
		this.status = 'stowed';
		this.tip = 0;
		this.pending = null;
		this.active = stowedPath(this.level);
		this.version++;
		this.aim(0);
		this.refresh();
	}

	/** Choose a work point. The arm only moves when `go` is called. */
	aim(target: number) {
		this.target = target;
		this.plan = checkPlan(this.level, target, this.bendLimit);
	}

	setBendLimit(v: number) {
		this.bendLimit = v;
		this.plan = checkPlan(this.level, this.target, v);
	}

	go() {
		const plan = this.plan;
		if (!plan?.path || plan.problem) return;
		if (this.active === plan.path && this.status !== 'retracting') {
			this.goal = this.active.length;
			this.status = 'advancing';
			return;
		}
		// Back out only as far as the new route diverges from the current one, then go forward.
		this.pending = plan;
		this.goal = Math.min(this.tip, sharedLength(this.active, plan.path));
		this.status = 'retracting';
	}

	retract() {
		this.pending = null;
		this.goal = 0;
		this.status = 'retracting';
	}

	private refresh() {
		this.pose = poseAt(this.active, this.tip, this.links, this.level.link, this.field);
		this.readout = this.pose;
	}

	tick(dt: number) {
		dt = Math.min(dt, 0.25);
		const v = 0.22 * this.speed;
		if (this.status === 'advancing' || this.status === 'retracting') {
			const dir = Math.sign(this.goal - this.tip);
			const step = Math.min(Math.abs(this.goal - this.tip), v * dt);
			this.tip += dir * step;
			if (Math.abs(this.goal - this.tip) < 1e-6) {
				if (this.status === 'retracting' && this.pending?.path) {
					this.active = this.pending.path;
					this.pending = null;
					this.goal = this.active.length;
					this.status = 'advancing';
				} else if (this.status === 'advancing') {
					this.status = 'arrived';
					this.visits++;
					this.onArrive?.(this);
				} else this.status = 'stowed';
			}
		}
		this.pose = poseAt(this.active, this.tip, this.links, this.level.link, this.field);
		this.clock += dt;
		if (this.clock > 0.1) {
			this.clock = 0;
			this.readout = this.pose;
		}
	}

	/** Tip position and heading, for the first-person camera. */
	tipPose() {
		const j = this.pose.joints;
		if (j.length < 2) return null;
		return { pos: j[0], dir: j[0].clone().sub(j[1]).normalize() };
	}
}
