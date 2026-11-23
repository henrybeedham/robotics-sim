/**
 * Solid primitives for snake-arm structures, and distance to them.
 * Everything is axis-aligned so distances are exact and cheap. Z-up, metres.
 */
export type Vec3 = [number, number, number];

/**
 * How a solid is drawn. `lid` and `shell` are the faces between the viewer and
 * the inside; the page can make them see-through.
 */
export type Part = 'shell' | 'lid' | 'wall' | 'floor' | 'plate' | 'tube';

export interface BoxSolid {
	kind: 'box';
	min: Vec3;
	max: Vec3;
	part: Part;
}

export interface CylSolid {
	kind: 'cyl';
	/** Axis the cylinder runs along: 0 = x, 1 = y, 2 = z. */
	axis: 0 | 1 | 2;
	c: Vec3;
	r: number;
	/** Half its length. */
	half: number;
	part: Part;
}

export type Solid = BoxSolid | CylSolid;

export const box = (min: Vec3, max: Vec3, part: Part): BoxSolid => ({
	kind: 'box',
	min,
	max,
	part
});

/** Unsigned distance from (x, y, z) to a solid; zero inside it. */
export function distTo(s: Solid, x: number, y: number, z: number) {
	if (s.kind === 'box') {
		const dx = Math.max(s.min[0] - x, 0, x - s.max[0]);
		const dy = Math.max(s.min[1] - y, 0, y - s.max[1]);
		const dz = Math.max(s.min[2] - z, 0, z - s.max[2]);
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}
	const p = [x, y, z];
	const a = s.axis;
	const u = (a + 1) % 3;
	const v = (a + 2) % 3;
	const radial = Math.hypot(p[u] - s.c[u], p[v] - s.c[v]) - s.r;
	const axial = Math.abs(p[a] - s.c[a]) - s.half;
	return Math.hypot(Math.max(radial, 0), Math.max(axial, 0));
}

export function distance(solids: Solid[], x: number, y: number, z: number) {
	let d = Infinity;
	for (const s of solids) {
		const e = distTo(s, x, y, z);
		if (e < d) d = e;
	}
	return d;
}

export interface Opening {
	/** Centre in the wall's two in-plane axes, in increasing axis order. */
	u: number;
	v: number;
	w: number;
	h: number;
}

/**
 * A thin wall perpendicular to `axis` at `at`, covering [u0, u1] × [v0, v1] in
 * the other two axes, with rectangular openings cut out. It is split into the
 * smallest set of boxes that leaves the openings clear.
 */
export function wall(
	axis: 0 | 1 | 2,
	at: number,
	t: number,
	u0: number,
	u1: number,
	v0: number,
	v1: number,
	openings: Opening[],
	part: Part
): BoxSolid[] {
	const [ua, va] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
	const us = [u0, u1, ...openings.flatMap((o) => [o.u - o.w / 2, o.u + o.w / 2])]
		.filter((x) => x >= u0 && x <= u1)
		.sort((a, b) => a - b);
	const vs = [v0, v1, ...openings.flatMap((o) => [o.v - o.h / 2, o.v + o.h / 2])]
		.filter((x) => x >= v0 && x <= v1)
		.sort((a, b) => a - b);
	const out: BoxSolid[] = [];
	for (let j = 0; j < vs.length - 1; j++) {
		// Merge runs of solid cells along u into one box per row.
		let start: number | null = null;
		for (let i = 0; i <= us.length - 1; i++) {
			const solid =
				i < us.length - 1 &&
				us[i + 1] - us[i] > 1e-6 &&
				vs[j + 1] - vs[j] > 1e-6 &&
				!openings.some((o) => {
					const cu = (us[i] + us[i + 1]) / 2;
					const cv = (vs[j] + vs[j + 1]) / 2;
					return Math.abs(cu - o.u) < o.w / 2 && Math.abs(cv - o.v) < o.h / 2;
				});
			if (solid && start === null) start = i;
			if (!solid && start !== null) {
				const min: Vec3 = [0, 0, 0];
				const max: Vec3 = [0, 0, 0];
				min[axis] = at - t / 2;
				max[axis] = at + t / 2;
				min[ua] = us[start];
				max[ua] = us[i];
				min[va] = vs[j];
				max[va] = vs[j + 1];
				out.push(box(min, max, part));
				start = null;
			}
		}
	}
	return out;
}
