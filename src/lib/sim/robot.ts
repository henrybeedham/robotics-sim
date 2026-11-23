/**
 * Kinematics for a six-axis articulated arm with a spherical wrist, mounted on a
 * linear rail along world X. World frame is Z-up, metres and radians.
 *
 * Joint conventions (all chosen so the arm reads naturally on screen):
 *  - J1 yaws the turret about Z.
 *  - J2 tilts the upper arm forward from vertical.
 *  - J3 is the forearm angle relative to perpendicular-to-the-upper-arm, so
 *    J2 = J3 = 0 puts the upper arm vertical and the forearm horizontal.
 *  - J4, J5, J6 form an X–Y–X wrist about the forearm axis.
 * The tool's approach direction is the flange's local +X.
 */
import { Matrix4, Vector3 } from 'three';

export const ARM = {
	/** Shoulder height above the floor. */
	d1: 0.78,
	/** Shoulder offset forward of the J1 axis. */
	a1: 0.2,
	/** Upper arm length. */
	a2: 0.95,
	/** Forearm length, elbow to wrist centre. */
	a3: 0.9,
	/** Wrist centre to flange. */
	d6: 0.14,
	/** Flange to tool centre point (the gripper's cup tips at mid-stroke). */
	tool: 0.26
} as const;

export type Joints = [number, number, number, number, number, number];

const deg = Math.PI / 180;

/** Joint limits in radians, [min, max]. */
export const LIMITS: [number, number][] = [
	[-185 * deg, 185 * deg],
	[-75 * deg, 110 * deg],
	[-160 * deg, 80 * deg],
	[-270 * deg, 270 * deg],
	[-130 * deg, 130 * deg],
	[-350 * deg, 350 * deg]
];

/** Maximum joint speeds at 100 % override, radians per second. */
export const JOINT_SPEED = [1.9, 1.7, 1.8, 3.2, 3.2, 4.2].map((v) => v);

/** Rail limits and speed. */
export const RAIL = { min: -1.6, max: 1.6, speed: 1.2 };

export const HOME: Joints = [-Math.PI / 2, 10 * deg, -25 * deg, 0, 75 * deg, 0];

const TWO_PI = Math.PI * 2;

export function wrapNear(angle: number, reference: number) {
	return angle + TWO_PI * Math.round((reference - angle) / TWO_PI);
}

/** Element (row, col) of a three.js Matrix4 (stored column-major). */
const el = (m: Matrix4, r: number, c: number) => m.elements[c * 4 + r];

const rx = (a: number) => new Matrix4().makeRotationX(a);
const ry = (a: number) => new Matrix4().makeRotationY(a);
const rz = (a: number) => new Matrix4().makeRotationZ(a);
const tr = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);

export interface Kinematics {
	/** World transforms of each moving frame, in chain order. */
	frames: Matrix4[];
	flange: Matrix4;
	tcp: Matrix4;
}

/** Forward kinematics. */
export function forward(q: Joints, rail: number): Kinematics {
	const frames: Matrix4[] = [];
	const m = tr(rail, 0, 0);
	m.multiply(rz(q[0]));
	frames.push(m.clone());
	m.multiply(tr(ARM.a1, 0, ARM.d1)).multiply(ry(q[1]));
	frames.push(m.clone());
	m.multiply(tr(0, 0, ARM.a2)).multiply(ry(q[2] + Math.PI / 2));
	frames.push(m.clone());
	m.multiply(tr(0, 0, ARM.a3))
		.multiply(ry(-Math.PI / 2))
		.multiply(rx(q[3]));
	frames.push(m.clone());
	m.multiply(ry(q[4]));
	frames.push(m.clone());
	m.multiply(rx(q[5]));
	frames.push(m.clone());
	const flange = m.clone().multiply(tr(ARM.d6, 0, 0));
	const tcp = flange.clone().multiply(tr(ARM.tool, 0, 0));
	return { frames, flange, tcp };
}

export function withinLimits(q: Joints) {
	return q.every((v, i) => v >= LIMITS[i][0] - 1e-9 && v <= LIMITS[i][1] + 1e-9);
}

/**
 * Closed-form inverse kinematics for the TCP pose `target` (world frame) with the
 * carriage at `rail`. Picks the elbow-up branch and the wrist solution nearest
 * `prev`, so consecutive calls give continuous motion. Returns null when the pose
 * is out of reach or would break a joint limit.
 */
export function inverse(target: Matrix4, rail: number, prev: Joints = HOME): Joints | null {
	const local = tr(-rail, 0, 0).multiply(target);
	const approach = new Vector3(el(local, 0, 0), el(local, 1, 0), el(local, 2, 0));
	const pos = new Vector3().setFromMatrixPosition(local);
	const wrist = pos.clone().addScaledVector(approach, -(ARM.tool + ARM.d6));

	// Nearest turret angle to the previous one that is still inside the J1 limits.
	const raw = Math.atan2(wrist.y, wrist.x);
	const q1 = [raw - TWO_PI, raw, raw + TWO_PI]
		.filter((a) => a >= LIMITS[0][0] && a <= LIMITS[0][1])
		.reduce((best, a) => (Math.abs(a - prev[0]) < Math.abs(best - prev[0]) ? a : best));
	const r = Math.hypot(wrist.x, wrist.y) - ARM.a1;
	const z = wrist.z - ARM.d1;
	const reach = Math.hypot(r, z);
	const { a2, a3 } = ARM;
	if (reach > a2 + a3 - 1e-6 || reach < Math.abs(a2 - a3) + 1e-6) return null;

	const alpha = Math.atan2(r, z);
	const beta = Math.acos((a2 * a2 + reach * reach - a3 * a3) / (2 * a2 * reach));
	const q2 = alpha - beta;
	const er = a2 * Math.sin(q2);
	const ez = a2 * Math.cos(q2);
	const psi = Math.atan2(r - er, z - ez);
	const q3 = psi - q2 - Math.PI / 2;

	// Orientation left for the wrist: M = R03ᵀ · R, decomposed as Rx(a)·Ry(b)·Rx(c).
	const r03 = rz(q1).multiply(ry(q2 + q3));
	const rot = new Matrix4().extractRotation(local);
	const m = r03.transpose().multiply(rot);

	const cb = Math.min(1, Math.max(-1, el(m, 0, 0)));
	const b = Math.acos(cb);
	let candidates: [number, number, number][];
	if (Math.sin(b) < 1e-6) {
		// Wrist singularity: only a + c is defined, so hold J4 where it was.
		const sum = Math.atan2(el(m, 2, 1), el(m, 1, 1));
		const a = prev[3];
		candidates = [[a, b, sum - a]];
	} else {
		const a = Math.atan2(el(m, 1, 0), -el(m, 2, 0));
		const c = Math.atan2(el(m, 0, 1), el(m, 0, 2));
		candidates = [
			[a, b, c],
			[a + Math.PI, -b, c + Math.PI]
		];
	}

	let best: Joints | null = null;
	let bestCost = Infinity;
	for (const [a, bb, c] of candidates) {
		const q: Joints = [q1, q2, q3, wrapNear(a, prev[3]), bb, wrapNear(c, prev[5])];
		if (!withinLimits(q)) continue;
		// Keep one wrist configuration (J5 positive) unless only the flipped one fits,
		// as a controller would; otherwise the wrist can swap halfway through a run.
		const flip = bb < 0 ? 100 : 0;
		const cost = flip + q.reduce((sum, v, i) => sum + Math.abs(v - prev[i]) * (i >= 3 ? 1 : 2), 0);
		if (cost < bestCost) {
			bestCost = cost;
			best = q;
		}
	}
	return best;
}

/** Build a tool pose from a TCP position, approach direction and the gripper's long axis. */
export function toolPose(position: Vector3, approach: Vector3, longAxis: Vector3) {
	const x = approach.clone().normalize();
	const y = longAxis.clone().addScaledVector(x, -longAxis.dot(x)).normalize();
	const z = new Vector3().crossVectors(x, y);
	return new Matrix4().makeBasis(x, y, z).setPosition(position);
}
