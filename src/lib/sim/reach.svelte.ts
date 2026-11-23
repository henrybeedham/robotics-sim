/**
 * Reach: a follow-the-leader snake arm working inside a wing box.
 *
 * The arm is a chain of short rigid links on a linear feed. Every point on its
 * body follows the path its tip has already travelled, so once the tip has
 * threaded a hole the rest of the arm threads it too. The planner builds that
 * path through the rib holes to a target, then checks it against the per-joint
 * bend limit and the box walls before the arm is allowed to move.
 * World frame is Z-up, metres.
 */
import { Vector3 } from 'three';

export const BOX = {
	x0: 0,
	x1: 3.0,
	y0: -0.45,
	y1: 0.45,
	z0: 0.7,
	z1: 1.08
};

/** Ribs across the span. Rib 0 is the root rib with the access hole; the last one is closed. */
export const RIBS = [
	{ x: 0, hole: { y: 0, z: 0.89, r: 0.1 } },
	{ x: 0.6, hole: { y: 0.13, z: 0.9, r: 0.09 } },
	{ x: 1.2, hole: { y: -0.12, z: 0.88, r: 0.09 } },
	{ x: 1.8, hole: { y: 0.1, z: 0.9, r: 0.09 } },
	{ x: 2.4, hole: { y: -0.13, z: 0.89, r: 0.09 } },
	{ x: 3.0, hole: null }
];

export const SNAKE = {
	links: 38,
	link: 0.1,
	radius: 0.026
};

/** Where the feed holds the arm before it enters: straight out from the access hole. */
const ENTRY = new Vector3(-0.35, RIBS[0].hole!.y, RIBS[0].hole!.z);

export interface Target {
	x: number;
	y: number;
}

export const PRESETS: { name: string; target: Target }[] = [
	{ name: 'Bay 2 · front spar', target: { x: 0.95, y: 0.33 } },
	{ name: 'Bay 3 · rear spar', target: { x: 1.5, y: -0.34 } },
	{ name: 'Bay 4 · centre', target: { x: 2.1, y: 0.0 } },
	{ name: 'Bay 5 · tip corner', target: { x: 2.85, y: 0.32 } }
];

/** Inspection height above the lower skin. */
const WORK_Z = BOX.z0 + 0.13;

export function bayOf(x: number) {
	for (let i = 0; i < RIBS.length - 1; i++) if (x >= RIBS[i].x && x < RIBS[i + 1].x) return i;
	return -1;
}

/** Keep a clicked target inside a bay, clear of ribs and spars. */
export function clampTarget(t: Target): Target {
	const m = 0.07;
	let x = Math.min(BOX.x1 - m, Math.max(BOX.x0 + 0.2, t.x));
	const b = bayOf(x);
	// Leave room after the last hole for the arm to turn down to the work point.
	if (b >= 0) x = Math.min(RIBS[b + 1].x - m, Math.max(RIBS[b].x + 0.2, x));
	const y = Math.min(BOX.y1 - m, Math.max(BOX.y0 + m, t.y));
	return { x, y };
}

/** A polyline with cumulative arc length, sampled finely enough to treat as smooth. */
export class Path {
	points: Vector3[];
	s: number[];
	constructor(points: Vector3[]) {
		this.points = points;
		this.s = [0];
		for (let i = 1; i < points.length; i++)
			this.s.push(this.s[i - 1] + points[i].distanceTo(points[i - 1]));
	}
	get length() {
		return this.s[this.s.length - 1];
	}
	/** Point at arc length `a`. Before the start it extends straight back along the entry. */
	at(a: number, out = new Vector3()) {
		if (a <= 0) {
			const dir = this.points[1].clone().sub(this.points[0]).normalize();
			return out.copy(this.points[0]).addScaledVector(dir, a);
		}
		if (a >= this.length) return out.copy(this.points[this.points.length - 1]);
		let lo = 0;
		let hi = this.s.length - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (this.s[mid] <= a) lo = mid;
			else hi = mid;
		}
		const t = (a - this.s[lo]) / (this.s[hi] - this.s[lo]);
		return out.copy(this.points[lo]).lerp(this.points[hi], t);
	}
}

const DX = 0.02;

/**
 * Plan the tip path as y(x), z(x) through the box. It starts as straight lines
 * between hole centres, then is relaxed to minimise bending energy (a discrete
 * fourth-difference smoother) while every rib crossing stays inside its hole,
 * less the arm's radius and a margin. The arm can therefore use the slack in
 * each hole to take the gentlest line, which is what keeps joint bends low.
 */
export function planPath(target: Target) {
	const bay = bayOf(target.x);
	const end = { x: target.x, y: target.y, z: WORK_Z };
	const xs: number[] = [];
	for (let x = ENTRY.x; x < end.x - 1e-9; x += DX) xs.push(x);
	xs.push(end.x);
	const n = xs.length;

	// Pinned straight lead-in until just inside the root rib.
	const fixedUntil = xs.findIndex((x) => x > 0.04);
	const waypoints = [
		{ x: ENTRY.x, y: ENTRY.y, z: ENTRY.z },
		...RIBS.slice(0, bay + 1).map((r) => ({ x: r.x, y: r.hole!.y, z: r.hole!.z })),
		end
	];
	const lerpAt = (x: number, key: 'y' | 'z') => {
		for (let i = 1; i < waypoints.length; i++) {
			const a = waypoints[i - 1];
			const b = waypoints[i];
			if (x <= b.x + 1e-9) return a[key] + ((b[key] - a[key]) * (x - a.x)) / (b.x - a.x || 1);
		}
		return end[key];
	};
	const y = xs.map((x) => lerpAt(x, 'y'));
	const z = xs.map((x) => lerpAt(x, 'z'));
	for (let i = 0; i < fixedUntil; i++) {
		y[i] = ENTRY.y;
		z[i] = ENTRY.z;
	}

	const ribIndex = RIBS.slice(0, bay + 1).map((r) => ({
		i: xs.reduce((best, x, k) => (Math.abs(x - r.x) < Math.abs(xs[best] - r.x) ? k : best), 0),
		hole: r.hole!
	}));
	const m = 0.012;
	const constrain = () => {
		for (const { i, hole } of ribIndex) {
			if (i < fixedUntil) continue;
			const room = hole.r - SNAKE.radius - m;
			const dy = y[i] - hole.y;
			const dz = z[i] - hole.z;
			const d = Math.hypot(dy, dz);
			if (d > room) {
				y[i] = hole.y + (dy * room) / d;
				z[i] = hole.z + (dz * room) / d;
			}
		}
		for (let i = fixedUntil; i < n - 1; i++) {
			y[i] = Math.min(BOX.y1 - 0.05, Math.max(BOX.y0 + 0.05, y[i]));
			z[i] = Math.min(BOX.z1 - 0.05, Math.max(BOX.z0 + 0.05, z[i]));
		}
	};

	const relax = (v: number[]) => {
		const next = v.slice();
		for (let i = Math.max(2, fixedUntil); i < n - 1; i++) {
			const a = v[i - 2];
			const b = v[i - 1];
			const c = v[i];
			const d = v[i + 1];
			const e = i + 2 < n ? v[i + 2] : 2 * v[n - 1] - v[n - 2];
			next[i] = c - 0.06 * (a - 4 * b + 6 * c - 4 * d + e);
		}
		for (let i = 0; i < n; i++) v[i] = next[i];
	};
	for (let k = 0; k < 2500; k++) {
		relax(y);
		relax(z);
		constrain();
	}
	return new Path(xs.map((x, i) => new Vector3(x, y[i], z[i])));
}

/** Distance from a point to the nearest structure (skins, spars, rib plates), minus nothing. */
export function clearanceAt(p: Vector3) {
	let d = Math.min(p.z - BOX.z0, BOX.z1 - p.z, p.y - BOX.y0, BOX.y1 - p.y);
	if (p.x < BOX.x0 - 0.01) d = Infinity; // outside the box only the root rib matters
	for (const rib of RIBS) {
		const dx = Math.abs(p.x - rib.x);
		if (dx > 0.3) continue;
		let rd: number;
		if (!rib.hole) rd = dx;
		else {
			const rho = Math.hypot(p.y - rib.hole.y, p.z - rib.hole.z);
			rd = rho >= rib.hole.r ? dx : Math.hypot(dx, rib.hole.r - rho);
		}
		d = Math.min(d, rd);
	}
	return d;
}

export interface Pose {
	/** Joint centres from the tip (index 0) back to the base. */
	joints: Vector3[];
	/** Bend at each joint between neighbouring links, degrees. */
	bends: number[];
	/** Clearance of each link to the structure, mm (after the arm's radius). */
	clearance: number[];
}

/** The arm's shape with its tip at arc length `tip` along `path`. */
export function poseAt(path: Path, tip: number): Pose {
	const joints: Vector3[] = [];
	for (let i = 0; i <= SNAKE.links; i++) joints.push(path.at(tip - i * SNAKE.link));
	const bends: number[] = [];
	for (let i = 1; i < SNAKE.links; i++) {
		const a = joints[i - 1].clone().sub(joints[i]).normalize();
		const b = joints[i]
			.clone()
			.sub(joints[i + 1])
			.normalize();
		bends.push((Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI);
	}
	const clearance: number[] = [];
	const m = new Vector3();
	for (let i = 0; i < SNAKE.links; i++) {
		let c = Infinity;
		for (const t of [0, 0.5, 1])
			c = Math.min(c, clearanceAt(m.copy(joints[i]).lerp(joints[i + 1], t)));
		clearance.push((c - SNAKE.radius) * 1000);
	}
	return { joints, bends, clearance };
}

export interface Plan {
	target: Target;
	path: Path;
	/** Worst bend anywhere along the way in, degrees, and where. */
	maxBend: number;
	maxBendJoint: number;
	/** Tightest clearance anywhere along the way in, mm. */
	minClearance: number;
	problem: string | null;
}

/** Sweep the arm along the whole path and check every intermediate shape. */
export function checkPlan(target: Target, bendLimit: number): Plan {
	const path = planPath(target);
	let maxBend = 0;
	let maxBendJoint = 0;
	let minClearance = Infinity;
	for (let tip = 0; tip <= path.length; tip += 0.02) {
		const pose = poseAt(path, Math.min(tip, path.length));
		pose.bends.forEach((b, i) => {
			if (b > maxBend) {
				maxBend = b;
				maxBendJoint = i + 1;
			}
		});
		minClearance = Math.min(minClearance, ...pose.clearance);
	}
	let problem: string | null = null;
	if (path.length > SNAKE.links * SNAKE.link - 0.05)
		problem = 'Too far: the arm is not long enough.';
	else if (maxBend > bendLimit)
		problem = `Joint ${maxBendJoint} would bend ${maxBend.toFixed(0)}°, over the ${bendLimit}° limit.`;
	else if (minClearance < 0) problem = 'The arm would touch the structure.';
	return { target, path, maxBend, maxBendJoint, minClearance, problem };
}

/** Arc length up to which two paths are the same, so a retreat can stop there. */
function sharedLength(a: Path, b: Path) {
	const p = new Vector3();
	const q = new Vector3();
	let shared = 0;
	for (let s = 0; s <= Math.min(a.length, b.length); s += 0.01) {
		if (a.at(s, p).distanceTo(b.at(s, q)) > 0.002) break;
		shared = s;
	}
	return shared;
}

export type ReachStatus = 'stowed' | 'advancing' | 'retracting' | 'arrived';

export class Reach {
	bendLimit = $state(28);
	speed = $state(1);
	target = $state<Target>(PRESETS[0].target);
	plan = $state.raw<Plan>(checkPlan(PRESETS[0].target, 28));
	status = $state<ReachStatus>('stowed');
	/** Tip position along the active path, metres. */
	tip = $state(0);
	/** Throttled copy of the pose for the panels. */
	readout = $state.raw<Pose>(poseAt(this.plan.path, 0));
	visits = $state(0);

	/** The path the arm is physically on, which can differ from `plan` while it retreats. */
	active: Path = this.plan.path;
	pose: Pose = this.readout;
	private goal = 0;
	private pending: Plan | null = null;
	private clock = 0;
	onArrive?: (r: Reach) => void;

	/** Choose a new target. The arm only moves when `go` is called. */
	aim(t: Target) {
		this.target = clampTarget(t);
		this.plan = checkPlan(this.target, this.bendLimit);
	}

	setBendLimit(v: number) {
		this.bendLimit = v;
		this.plan = checkPlan(this.target, v);
	}

	get insideLinks() {
		return this.readout.joints.filter((j) => j.x > BOX.x0).length;
	}

	go() {
		if (this.plan.problem) return;
		if (this.active === this.plan.path && this.status !== 'retracting') {
			this.goal = this.active.length;
			this.status = 'advancing';
			return;
		}
		// Back out only as far as the new route diverges from the current one, then go forward.
		this.pending = this.plan;
		this.goal = Math.min(this.tip, sharedLength(this.active, this.plan.path));
		this.status = 'retracting';
	}

	retract() {
		this.pending = null;
		this.goal = 0;
		this.status = 'retracting';
	}

	tick(dt: number) {
		dt = Math.min(dt, 0.25);
		const v = 0.22 * this.speed;
		if (this.status === 'advancing' || this.status === 'retracting') {
			const dir = Math.sign(this.goal - this.tip);
			const step = Math.min(Math.abs(this.goal - this.tip), v * dt);
			this.tip += dir * step;
			if (Math.abs(this.goal - this.tip) < 1e-6) {
				if (this.status === 'retracting' && this.pending) {
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
		this.pose = poseAt(this.active, this.tip);
		this.clock += dt;
		if (this.clock > 0.1) {
			this.clock = 0;
			this.readout = this.pose;
		}
	}
}
