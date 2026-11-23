/**
 * Route planning for a follow-the-leader snake arm in any structure.
 *
 *  1. Sample the distance to the structure on a grid (a distance field).
 *  2. Search the grid with A* for a route through cells wide enough for the
 *     arm, preferring cells far from the walls.
 *  3. Relax that route: minimise bending energy (fourth differences) with a
 *     little tension, while pushing any point that gets too close to a wall
 *     back out along the field's gradient.
 * The result is a smooth centre-line the whole arm can follow. Z-up, metres.
 */
import { Vector3 } from 'three';
import { distance, type Vec3 } from './geometry.js';
import type { Level } from './levels.js';

/** A polyline with cumulative arc length. */
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
	/** Point at arc length `a`. Before the start it extends straight back along the first segment. */
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
		const t = (a - this.s[lo]) / (this.s[hi] - this.s[lo] || 1);
		return out.copy(this.points[lo]).lerp(this.points[hi], t);
	}
}

/** Distance to the structure sampled on a regular grid, with trilinear lookup. */
export class Field {
	min: Vec3;
	h: number;
	n: [number, number, number];
	d: Float32Array;

	constructor(level: Level) {
		this.min = level.min;
		this.h = level.voxel;
		this.n = [0, 1, 2].map((a) => Math.ceil((level.max[a] - level.min[a]) / this.h) + 1) as [
			number,
			number,
			number
		];
		const [nx, ny, nz] = this.n;
		this.d = new Float32Array(nx * ny * nz);
		// Only solids near a sample can be the nearest one, so bucket them by x first.
		const solids = level.solids;
		for (let i = 0; i < nx; i++) {
			const x = this.min[0] + i * this.h;
			const near = solids.filter((s) =>
				s.kind === 'box'
					? x > s.min[0] - 0.6 && x < s.max[0] + 0.6
					: s.axis === 0
						? Math.abs(x - s.c[0]) < s.half + 0.6
						: Math.abs(x - s.c[0]) < s.r + 0.6
			);
			for (let j = 0; j < ny; j++) {
				const y = this.min[1] + j * this.h;
				for (let k = 0; k < nz; k++) {
					const z = this.min[2] + k * this.h;
					this.d[(i * ny + j) * nz + k] = Math.min(0.6, distance(near, x, y, z));
				}
			}
		}
	}

	index(i: number, j: number, k: number) {
		return (i * this.n[1] + j) * this.n[2] + k;
	}

	/** Field value at a point; outside the grid counts as open space. */
	at(x: number, y: number, z: number) {
		const fx = (x - this.min[0]) / this.h;
		const fy = (y - this.min[1]) / this.h;
		const fz = (z - this.min[2]) / this.h;
		const [nx, ny, nz] = this.n;
		if (fx < 0 || fy < 0 || fz < 0 || fx > nx - 1 || fy > ny - 1 || fz > nz - 1) return 0.6;
		const i = Math.min(nx - 2, Math.floor(fx));
		const j = Math.min(ny - 2, Math.floor(fy));
		const k = Math.min(nz - 2, Math.floor(fz));
		const tx = fx - i;
		const ty = fy - j;
		const tz = fz - k;
		const d = this.d;
		const c = (a: number, b: number, e: number) => d[this.index(i + a, j + b, k + e)];
		const x00 = c(0, 0, 0) * (1 - tx) + c(1, 0, 0) * tx;
		const x10 = c(0, 1, 0) * (1 - tx) + c(1, 1, 0) * tx;
		const x01 = c(0, 0, 1) * (1 - tx) + c(1, 0, 1) * tx;
		const x11 = c(0, 1, 1) * (1 - tx) + c(1, 1, 1) * tx;
		return (x00 * (1 - ty) + x10 * ty) * (1 - tz) + (x01 * (1 - ty) + x11 * ty) * tz;
	}

	gradient(p: Vector3, out = new Vector3()) {
		const e = this.h * 0.5;
		return out
			.set(
				this.at(p.x + e, p.y, p.z) - this.at(p.x - e, p.y, p.z),
				this.at(p.x, p.y + e, p.z) - this.at(p.x, p.y - e, p.z),
				this.at(p.x, p.y, p.z + e) - this.at(p.x, p.y, p.z - e)
			)
			.normalize();
	}
}

/** Smallest binary heap keyed on f. */
class Heap {
	keys: number[] = [];
	vals: number[] = [];
	get size() {
		return this.keys.length;
	}
	push(k: number, v: number) {
		const K = this.keys;
		const V = this.vals;
		let i = K.length;
		K.push(k);
		V.push(v);
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (K[p] <= k) break;
			K[i] = K[p];
			V[i] = V[p];
			i = p;
		}
		K[i] = k;
		V[i] = v;
	}
	pop() {
		const K = this.keys;
		const V = this.vals;
		const top = V[0];
		const k = K.pop()!;
		const v = V.pop()!;
		if (K.length) {
			let i = 0;
			for (;;) {
				const l = 2 * i + 1;
				if (l >= K.length) break;
				const r = l + 1;
				const c = r < K.length && K[r] < K[l] ? r : l;
				if (K[c] >= k) break;
				K[i] = K[c];
				V[i] = V[c];
				i = c;
			}
			K[i] = k;
			V[i] = v;
		}
		return top;
	}
}

const NEIGHBOURS: [number, number, number, number][] = [];
for (let a = -1; a <= 1; a++)
	for (let b = -1; b <= 1; b++)
		for (let c = -1; c <= 1; c++) if (a || b || c) NEIGHBOURS.push([a, b, c, Math.hypot(a, b, c)]);

/** A* over grid cells whose clearance is at least `need`. Returns cell centres, or null. */
function search(field: Field, from: Vector3, to: Vector3, need: number): Vector3[] | null {
	const [nx, ny, nz] = field.n;
	const h = field.h;
	const toCell = (p: Vector3) =>
		[0, 1, 2].map((a) => Math.round((p.getComponent(a) - field.min[a]) / h)) as [
			number,
			number,
			number
		];
	const free = (i: number, j: number, k: number) =>
		i >= 0 &&
		j >= 0 &&
		k >= 0 &&
		i < nx &&
		j < ny &&
		k < nz &&
		field.d[field.index(i, j, k)] >= need;

	// Snap the ends to the nearest free cell if they sit just inside the margin.
	const snap = (p: Vector3) => {
		const [i, j, k] = toCell(p);
		let best: [number, number, number] | null = null;
		let bestD = Infinity;
		for (let a = -3; a <= 3; a++)
			for (let b = -3; b <= 3; b++)
				for (let c = -3; c <= 3; c++)
					if (free(i + a, j + b, k + c) && a * a + b * b + c * c < bestD) {
						bestD = a * a + b * b + c * c;
						best = [i + a, j + b, k + c];
					}
		return best;
	};
	const s = snap(from);
	const g = snap(to);
	if (!s || !g) return null;

	const total = nx * ny * nz;
	const cost = new Float32Array(total).fill(Infinity);
	const prev = new Int32Array(total).fill(-1);
	const closed = new Uint8Array(total);
	const si = field.index(...s);
	const gi = field.index(...g);
	const heap = new Heap();
	cost[si] = 0;
	heap.push(0, si);
	const hx = (i: number, j: number, k: number) => Math.hypot(i - g[0], j - g[1], k - g[2]) * h;
	while (heap.size) {
		const cur = heap.pop();
		if (cur === gi) break;
		if (closed[cur]) continue;
		closed[cur] = 1;
		const k = cur % nz;
		const j = Math.floor(cur / nz) % ny;
		const i = Math.floor(cur / (ny * nz));
		for (const [a, b, c, len] of NEIGHBOURS) {
			const ii = i + a;
			const jj = j + b;
			const kk = k + c;
			if (!free(ii, jj, kk)) continue;
			const n = field.index(ii, jj, kk);
			if (closed[n]) continue;
			// Prefer the middle of a passage: cells near walls cost more.
			const d = field.d[n];
			const step = len * h * (1 + 8 * Math.max(0, (0.16 - d) / 0.16));
			const nc = cost[cur] + step;
			if (nc < cost[n]) {
				cost[n] = nc;
				prev[n] = cur;
				heap.push(nc + hx(ii, jj, kk), n);
			}
		}
	}
	if (prev[gi] < 0 && gi !== si) return null;
	const out: Vector3[] = [];
	for (let c = gi; c >= 0; c = prev[c]) {
		const k = c % nz;
		const j = Math.floor(c / nz) % ny;
		const i = Math.floor(c / (ny * nz));
		out.push(new Vector3(field.min[0] + i * h, field.min[1] + j * h, field.min[2] + k * h));
		if (c === si) break;
	}
	return out.reverse();
}

/**
 * Implicit smoothing: solve (I + λ·DᵀD) x = p for the free points, where D is
 * the second-difference operator, with the first `fixed` points and the last
 * point held. One coordinate at a time, using a banded Cholesky factorisation.
 */
export function smoothPath(
	points: Vector3[],
	fixed: number,
	lambda: number,
	weights?: number[],
	targets?: Vector3[]
) {
	const n = points.length;
	const out = points.map((p) => p.clone());
	const f0 = Math.max(fixed, 2);
	const free = n - 1 - f0;
	if (free < 1) return out;
	// Pentadiagonal DᵀD row for index i of a length-n chain.
	const row = (i: number) => {
		const r = new Map<number, number>();
		for (let k = 1; k < n - 1; k++) {
			if (Math.abs(k - i) > 1) continue;
			const coeff = [1, -2, 1];
			const ci = i - (k - 1);
			for (let m = 0; m < 3; m++) r.set(k - 1 + m, (r.get(k - 1 + m) ?? 0) + coeff[ci] * coeff[m]);
		}
		return r;
	};
	// Band storage: L[i][b] = entry (i, i - b), b = 0..2.
	const A: number[][] = [];
	const rhs: [number, number, number][] = [];
	for (let a = 0; a < free; a++) {
		const i = f0 + a;
		const r = row(i);
		const w = weights?.[i] ?? 1;
		const c = targets?.[i] ?? points[i];
		const band = [
			w + lambda * (r.get(i) ?? 0),
			lambda * (r.get(i - 1) ?? 0),
			lambda * (r.get(i - 2) ?? 0)
		];
		A.push(band);
		const b: [number, number, number] = [w * c.x, w * c.y, w * c.z];
		for (const [j, v] of r) {
			if (j >= f0 && j < n - 1) continue;
			b[0] -= lambda * v * points[j].x;
			b[1] -= lambda * v * points[j].y;
			b[2] -= lambda * v * points[j].z;
		}
		rhs.push(b);
	}
	// Cholesky in band form.
	const L: number[][] = A.map(() => [0, 0, 0]);
	for (let i = 0; i < free; i++) {
		for (let b = 2; b >= 1; b--) {
			const j = i - b;
			if (j < 0) continue;
			let sum = A[i][b];
			for (let k = b + 1; k <= 2; k++) if (j - (k - b) >= 0) sum -= L[i][k] * L[j][k - b];
			L[i][b] = sum / L[j][0];
		}
		let d = A[i][0];
		for (let k = 1; k <= 2; k++) if (i - k >= 0) d -= L[i][k] * L[i][k];
		L[i][0] = Math.sqrt(Math.max(d, 1e-12));
	}
	for (let c = 0; c < 3; c++) {
		const y = new Array<number>(free);
		for (let i = 0; i < free; i++) {
			let v = rhs[i][c];
			for (let k = 1; k <= 2; k++) if (i - k >= 0) v -= L[i][k] * y[i - k];
			y[i] = v / L[i][0];
		}
		const x = new Array<number>(free);
		for (let i = free - 1; i >= 0; i--) {
			let v = y[i];
			for (let k = 1; k <= 2; k++) if (i + k < free) v -= L[i + k][k] * x[i + k];
			x[i] = v / L[i][0];
		}
		for (let i = 0; i < free; i++) out[f0 + i].setComponent(c, x[i]);
	}
	return out;
}

function resample(points: Vector3[], ds: number) {
	const path = new Path(points);
	const n = Math.max(2, Math.round(path.length / ds));
	return Array.from({ length: n + 1 }, (_, i) => path.at((path.length * i) / n));
}

export interface Route {
	path: Path | null;
	problem: string | null;
}

/**
 * Plan from the feed, through the access hole, to `goal`.
 * `radius` is the arm's radius; `margin` the clearance the route should keep.
 */
export function route(
	level: Level,
	field: Field,
	goal: Vector3,
	radius: number,
	margin = 0.014
): Route {
	const entry = new Vector3(...level.entry);
	const feed = entry.clone().add(new Vector3(-0.35, 0, 0));
	const inside = entry.clone().add(new Vector3(0.06, 0, 0));
	const need = radius + margin * 0.6;
	if (field.at(goal.x, goal.y, goal.z) < radius + 0.004)
		return { path: null, problem: 'That work point is inside the structure.' };
	const cells = search(field, inside, goal, need);
	if (!cells) return { path: null, problem: 'No route: the passages are too narrow for the arm.' };

	const lead = feed.distanceTo(inside);
	const push = radius + margin;
	const keep = radius + margin * 0.5;
	const g = new Vector3();
	const ds = 0.05;
	let pts = resample([feed, inside, ...cells.slice(1, -1), goal], ds);

	// Constrained smoothing. Each pass solves (W + λ·DᵀD) x = W·c: bending is
	// penalised everywhere, points with room are held only loosely, and points
	// too close to a wall are held stiffly at a pushed-out position (or, if they
	// have slipped into a thin wall, at their last clear position). Because the
	// constraints sit inside one solve, bending spreads smoothly around them.
	const fixed = Math.ceil(lead / ds) + 1;
	const step = new Vector3();
	const mid = (a: Vector3, b: Vector3) =>
		field.at((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
	// Ramp the smoothing up so each stage starts from a clear, already gentler route.
	for (const lambda of [200, 800, 3000, 10000, 30000]) {
		for (let it = 0; it < 30; it++) {
			const weights: number[] = [];
			const targets: Vector3[] = [];
			for (const p of pts) {
				const d = field.at(p.x, p.y, p.z);
				if (d >= push + 0.01) {
					weights.push(1);
					targets.push(p);
				} else {
					targets.push(p.clone().addScaledVector(field.gradient(p, g), push + 0.012 - d));
					weights.push(Math.max(300, lambda * 2));
				}
			}
			const proposal = smoothPath(pts, fixed, lambda, weights, targets);
			// Take each proposed move in small steps, and only where the point and
			// the segments to its neighbours stay clear, so it can never enter a wall.
			for (let i = fixed; i < pts.length - 1; i++) {
				const p = pts[i];
				const q = p.clone().add(step.subVectors(proposal[i], p).clampLength(0, ds * 0.3));
				if (
					field.at(q.x, q.y, q.z) >= keep &&
					mid(q, pts[i - 1]) >= keep * 0.85 &&
					mid(q, pts[i + 1]) >= keep * 0.85
				)
					pts[i] = q;
			}
		}
	}
	pts = resample(pts, 0.025);
	pts[pts.length - 1].copy(goal);
	return { path: new Path(pts), problem: null };
}
