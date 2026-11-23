/**
 * The cell: a rail-mounted arm between a kitting table (−Y side) and a curved
 * layup mould (+Y side). Everything here is plain geometry so it can be tested
 * without a renderer. World frame is Z-up, metres.
 */
import { Matrix4, Vector3 } from 'three';
import { toolPose } from './robot';

export type MouldId = 'wing' | 'saddle' | 'flat';

export const MOULDS: { id: MouldId; name: string; note: string }[] = [
	{ id: 'wing', name: 'Wing skin', note: 'Cambered across the chord, twisted along the span' },
	{ id: 'saddle', name: 'Saddle', note: 'Doubly curved: convex one way, concave the other' },
	{ id: 'flat', name: 'Flat panel', note: 'A flat caul plate, for a baseline' }
];

export const MOULD = { x: 0, y: 1.12, length: 2.3, depth: 0.8, base: 0.5 };
export const KIT = { y: -1.05, top: 0.74, length: 2.4, depth: 0.62 };

export const PLY = {
	/** Along the gripper's long axis (world X). */
	length: 0.62,
	width: 0.34,
	/** Dry carbon non-crimp fabric, kg per square metre. */
	arealMass: 0.6,
	/** Cured ply thickness, used only to lift each layer on screen. */
	visualThickness: 0.0012
};
export const PLY_MASS = PLY.length * PLY.width * PLY.arealMass;

/** Where plies land along the mould span, by number of stations in use. */
export function stationXs(count: number) {
	const pitch = PLY.length + 0.06;
	return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);
}

/** Mould surface height at a world (x, y). */
export function mouldHeight(id: MouldId, x: number, y: number) {
	const u = (x - MOULD.x) / (MOULD.length / 2);
	const v = (y - MOULD.y) / (MOULD.depth / 2);
	switch (id) {
		case 'wing':
			return 0.78 + 0.2 * (1 - v * v) - 0.03 * u * u + 0.05 * u * v;
		case 'saddle':
			return 0.86 + 0.1 * u * u - 0.15 * v * v;
		case 'flat':
			return 0.86;
	}
}

export function mouldNormal(id: MouldId, x: number, y: number) {
	const h = 1e-4;
	const dx = (mouldHeight(id, x + h, y) - mouldHeight(id, x - h, y)) / (2 * h);
	const dy = (mouldHeight(id, x, y + h) - mouldHeight(id, x, y - h)) / (2 * h);
	return new Vector3(-dx, -dy, 1).normalize();
}

/** Distance along `dir` from `origin` to the mould surface (negative if the surface is behind). */
export function rayToMould(id: MouldId, origin: Vector3, dir: Vector3) {
	let s = (origin.z - mouldHeight(id, origin.x, origin.y)) / -dir.z;
	for (let i = 0; i < 8; i++) {
		const px = origin.x + s * dir.x;
		const py = origin.y + s * dir.y;
		s = (origin.z - mouldHeight(id, px, py)) / -dir.z;
	}
	return s;
}

/** A planar offset in the gripper's plate frame: u along the long axis, v across it. */
export interface Offset2 {
	u: number;
	v: number;
	theta: number;
}
export const IDENTITY: Offset2 = { u: 0, v: 0, theta: 0 };

export function compose(a: Offset2, b: Offset2): Offset2 {
	const c = Math.cos(a.theta);
	const s = Math.sin(a.theta);
	return { u: a.u + c * b.u - s * b.v, v: a.v + s * b.u + c * b.v, theta: a.theta + b.theta };
}

export function invert(a: Offset2): Offset2 {
	const c = Math.cos(a.theta);
	const s = Math.sin(a.theta);
	return { u: -(c * a.u + s * a.v), v: -(-s * a.u + c * a.v), theta: -a.theta };
}

export function applyOffset(a: Offset2, u: number, v: number): [number, number] {
	const c = Math.cos(a.theta);
	const s = Math.sin(a.theta);
	return [a.u + c * u - s * v, a.v + s * u + c * v];
}

export const PLY_CORNERS: [number, number][] = [
	[-PLY.length / 2, -PLY.width / 2],
	[PLY.length / 2, -PLY.width / 2],
	[PLY.length / 2, PLY.width / 2],
	[-PLY.length / 2, PLY.width / 2]
];

/** Worst corner displacement of a ply placed with offset `e`, in metres. */
export function cornerDeviation(e: Offset2) {
	return Math.max(
		...PLY_CORNERS.map(([u, v]) => {
			const [x, y] = applyOffset(e, u, v);
			return Math.hypot(x - u, y - v);
		})
	);
}

/** Apply a plate-frame offset to a tool pose (moves and turns it within its own plate). */
export function offsetPose(pose: Matrix4, o: Offset2) {
	const t = new Matrix4().makeTranslation(0, o.u, o.v);
	const r = new Matrix4().makeRotationX(o.theta);
	return pose.clone().multiply(t).multiply(r);
}

const DOWN = new Vector3(0, 0, -1);
const ALONG = new Vector3(1, 0, 0);

/** Nominal TCP pose for picking from kit slot `x`. */
export function kitPose(x: number) {
	return toolPose(new Vector3(x, KIT.y, KIT.top + 0.002), DOWN, ALONG);
}

/** Nominal TCP pose for laying a ply centred at station `x` on the mould. */
export function placePose(id: MouldId, x: number) {
	const c = new Vector3(x, MOULD.y, mouldHeight(id, x, MOULD.y));
	const n = mouldNormal(id, x, MOULD.y);
	return toolPose(c, n.clone().negate(), ALONG);
}

/** Lift a pose back along its approach axis by `d` metres. */
export function standOff(pose: Matrix4, d: number) {
	return pose.clone().multiply(new Matrix4().makeTranslation(-d, 0, 0));
}

/**
 * The conformal gripper's shape for a given place pose: how far along the
 * approach axis the surface lies under each plate point (u, v). Cups extend by
 * this much so every cup touches the mould at the same moment, which is what
 * lets a flat ply be laid onto a curved tool in one motion.
 */
export function conformProfile(id: MouldId, pose: Matrix4) {
	const origin = new Vector3().setFromMatrixPosition(pose);
	const x = new Vector3();
	const y = new Vector3();
	const z = new Vector3();
	pose.extractBasis(x, y, z);
	const p = new Vector3();
	return (u: number, v: number) => {
		p.copy(origin).addScaledVector(y, u).addScaledVector(z, v);
		return rayToMould(id, p, x);
	};
}

/** Cup layout on the gripper plate (u along the long axis, v across). */
export const CUPS: [number, number][] = (() => {
	const us = [-0.26, -0.156, -0.052, 0.052, 0.156, 0.26];
	const vs = [-0.12, 0, 0.12];
	return us.flatMap((u) => vs.map((v) => [u, v] as [number, number]));
})();
/** Cup stroke either side of mid-stroke. */
export const CUP_STROKE = 0.08;

/** Ply mesh resolution. */
export const PLY_GRID = { nu: 18, nv: 10 };
