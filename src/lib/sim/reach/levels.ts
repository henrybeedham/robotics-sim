/**
 * The structures the snake arm can explore, easiest first. Each one is a set
 * of solids, an access hole in the plane x = 0 that the feed points through,
 * and named work points inside. Z-up, metres.
 */
import { rng } from '../random.js';
import { box, wall, type Opening, type Solid, type Vec3 } from './geometry.js';

export interface WorkPoint {
	name: string;
	p: Vec3;
}

export interface Level {
	id: string;
	name: string;
	/** 1 (easy) to 5 (hard). */
	difficulty: number;
	blurb: string;
	solids: Solid[];
	/** Planning space: the inside of the structure plus the approach in front of it. */
	min: Vec3;
	max: Vec3;
	/** Centre of the access hole, on the plane x = 0. */
	entry: Vec3;
	links: number;
	/** Link length for this structure's arm: shorter links bend less per joint. */
	link: number;
	bendLimit: number;
	/** Grid spacing used by the planner, metres. */
	voxel: number;
	targets: WorkPoint[];
	/** Height of the jig the structure sits on. */
	standTop: number;
	/** Seed for generated levels, or null. */
	seed: number | null;
}

const T = 0.01;
const sq = (u: number, v: number, s: number): Opening => ({ u, v, w: s, h: s });

function wingBox(): Level {
	const [x1, y0, y1, z0, z1] = [3.0, -0.45, 0.45, 0.7, 1.08];
	const ribs = [
		{ x: 0, hole: sq(0, 0.89, 0.2) },
		{ x: 0.6, hole: sq(0.13, 0.9, 0.18) },
		{ x: 1.2, hole: sq(-0.12, 0.88, 0.18) },
		{ x: 1.8, hole: sq(0.1, 0.9, 0.18) },
		{ x: 2.4, hole: sq(-0.13, 0.89, 0.18) }
	];
	const solids: Solid[] = [
		box([0, y0, z0 - 0.012], [x1, y1, z0], 'floor'),
		box([0, y0, z1], [x1, y1, z1 + 0.012], 'lid'),
		box([0, y0 - T, z0], [x1, y0, z1], 'shell'),
		box([0, y1, z0], [x1, y1 + T, z1], 'wall'),
		box([x1 - T, y0, z0], [x1, y1, z1], 'wall'),
		...ribs.flatMap((r) =>
			wall(0, r.x, 0.008, y0, y1, z0, z1, [r.hole], r.x === 0 ? 'wall' : 'plate')
		),
		// Stringers along the lower skin
		...[-0.33, -0.2, 0.2, 0.33].map((y) =>
			box([0.02, y - 0.003, z0], [x1 - 0.02, y + 0.003, z0 + 0.045], 'plate')
		)
	];
	const w = z0 + 0.13;
	return {
		id: 'wing',
		name: 'Wing box',
		difficulty: 1,
		blurb: 'Five bays, one lightening hole per rib.',
		solids,
		min: [-0.45, y0 - 0.05, z0 - 0.05],
		max: [x1 + 0.05, y1 + 0.05, z1 + 0.05],
		entry: [0, 0, 0.89],
		links: 38,
		link: 0.1,
		bendLimit: 28,
		voxel: 0.025,
		targets: [
			{ name: 'Bay 2 · front spar', p: [0.95, 0.33, w] },
			{ name: 'Bay 3 · rear spar', p: [1.5, -0.34, w] },
			{ name: 'Bay 4 · centre', p: [2.1, 0, w] },
			{ name: 'Bay 5 · tip corner', p: [2.85, 0.32, w] }
		],
		standTop: z0 - 0.012,
		seed: null
	};
}

function fuelTank(): Level {
	const [x1, y0, y1, z0, z1] = [2.7, -0.45, 0.45, 0.55, 1.25];
	const baffles = [
		{ x: 0.5, hole: sq(-0.15, 0.78, 0.24) },
		{ x: 1.05, hole: sq(0.15, 1.02, 0.24) },
		{ x: 1.6, hole: sq(-0.15, 1.02, 0.24) },
		{ x: 2.15, hole: sq(0.15, 0.78, 0.24) }
	];
	const solids: Solid[] = [
		box([0, y0, z0 - 0.012], [x1, y1, z0], 'floor'),
		box([0, y0, z1], [x1, y1, z1 + 0.012], 'lid'),
		box([0, y0 - T, z0], [x1, y0, z1], 'shell'),
		box([0, y1, z0], [x1, y1 + T, z1], 'wall'),
		box([x1 - T, y0, z0], [x1, y1, z1], 'wall'),
		...wall(0, 0, T, y0, y1, z0, z1, [sq(0, 0.9, 0.22)], 'wall'),
		...baffles.flatMap((b) => wall(0, b.x, T, y0, y1, z0, z1, [b.hole], 'plate'))
	];
	return {
		id: 'tank',
		name: 'Fuel tank',
		difficulty: 2,
		blurb: 'Slosh baffles with their openings staggered high, low, left and right.',
		solids,
		min: [-0.45, y0 - 0.05, z0 - 0.05],
		max: [x1 + 0.05, y1 + 0.05, z1 + 0.05],
		entry: [0, 0, 0.9],
		links: 50,
		link: 0.1,
		bendLimit: 30,
		voxel: 0.025,
		targets: [
			{ name: 'Bay 2 · roof', p: [0.85, 0.15, 1.12] },
			{ name: 'Bay 3 · floor weld', p: [1.4, 0.0, 0.68] },
			{ name: 'Bay 4 · roof', p: [1.95, 0.25, 1.12] },
			{ name: 'Aft sump', p: [2.5, -0.3, 0.66] }
		],
		standTop: z0 - 0.012,
		seed: null
	};
}

type Cell = [number, number, number];
const key = (c: Cell) => c.join(',');

/**
 * Build walls around a set of open cells. Faces between connected cells are
 * left open (fully, or as a smaller doorway); every other face of an open cell
 * gets a wall. The entry cell also gets an access hole in its −x face.
 */
function cells(
	open: Cell[],
	links: [Cell, Cell][],
	size: number,
	origin: Vec3,
	door: number | null,
	entry: Cell
) {
	const isOpen = new Set(open.map(key));
	const joined = new Set(links.flatMap(([a, b]) => [`${key(a)}|${key(b)}`, `${key(b)}|${key(a)}`]));
	const solids: Solid[] = [];
	const done = new Set<string>();
	const lo = (c: Cell, a: number) => origin[a] + c[a] * size;
	for (const c of open) {
		for (let axis = 0 as 0 | 1 | 2; axis < 3; axis++) {
			for (const dir of [-1, 1]) {
				const n: Cell = [...c];
				n[axis] += dir;
				const face = dir < 0 ? `${key(n)}>${key(c)}` : `${key(c)}>${key(n)}`;
				if (done.has(face)) continue;
				done.add(face);
				const at = lo(c, axis) + (dir > 0 ? size : 0);
				const [ua, va] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
				const u0 = lo(c, ua);
				const v0 = lo(c, va);
				const centre = sq(u0 + size / 2, v0 + size / 2, door ?? size);
				const connected = joined.has(`${key(c)}|${key(n)}`);
				const isEntry = axis === 0 && dir < 0 && key(c) === key(entry);
				if (connected && door === null) continue;
				const holes =
					connected || isEntry
						? [isEntry ? sq(u0 + size / 2, v0 + size / 2, Math.min(door ?? 0.22, 0.22)) : centre]
						: [];
				// Faces facing the default camera, and the roof, can be made see-through.
				const outside = !isOpen.has(key(n));
				const part =
					axis === 2 && dir > 0 && outside
						? 'lid'
						: axis === 1 && dir < 0 && outside
							? 'shell'
							: axis === 2 && dir < 0 && outside
								? 'floor'
								: 'wall';
				solids.push(...wall(axis, at, T, u0, u0 + size, v0, v0 + size, holes, part));
			}
		}
	}
	return solids;
}

const centreOf = (c: Cell, size: number, origin: Vec3, dz = 0): Vec3 => [
	origin[0] + (c[0] + 0.5) * size,
	origin[1] + (c[1] + 0.5) * size,
	origin[2] + (c[2] + 0.5) * size + dz
];

function ducts(): Level {
	const size = 0.34;
	const origin: Vec3 = [0, -size / 2, 0.6];
	const route: Cell[] = [
		[0, 0, 0],
		[1, 0, 0],
		[2, 0, 0],
		[2, 0, 1],
		[2, 0, 2],
		[2, 1, 2],
		[2, 2, 2],
		[3, 2, 2],
		[4, 2, 2],
		[4, 2, 1],
		[4, 2, 0],
		[4, 1, 0],
		[5, 1, 0]
	];
	const branch: Cell[] = [
		[2, 2, 2],
		[2, 3, 2],
		[3, 3, 2]
	];
	const links: [Cell, Cell][] = [
		...route.slice(1).map((c, i) => [route[i], c] as [Cell, Cell]),
		...branch.slice(1).map((c, i) => [branch[i], c] as [Cell, Cell])
	];
	const open = [...route, ...branch.slice(1)];
	return {
		id: 'ducts',
		name: 'Duct run',
		difficulty: 3,
		blurb: 'Square ducting with a riser, two elbows on top and a branch.',
		solids: cells(open, links, size, origin, null, [0, 0, 0]),
		min: [-0.45, origin[1] - 0.05, origin[2] - 0.05],
		max: [origin[0] + 6 * size + 0.05, origin[1] + 4 * size + 0.05, origin[2] + 3 * size + 0.05],
		entry: centreOf([0, 0, 0], size, origin).map((v, i) => (i === 0 ? 0 : v)) as Vec3,
		links: 62,
		link: 0.1,
		bendLimit: 32,
		voxel: 0.025,
		targets: [
			{ name: 'Riser top', p: centreOf([2, 0, 2], size, origin) },
			{ name: 'Branch end', p: centreOf([3, 3, 2], size, origin) },
			{ name: 'Drop bottom', p: centreOf([4, 2, 0], size, origin, -0.06) },
			{ name: 'Outlet', p: centreOf([5, 1, 0], size, origin) }
		],
		standTop: origin[2] - T / 2,
		seed: null
	};
}

function exchanger(): Level {
	const [x1, y0, y1, z0, z1] = [1.85, -0.4, 0.4, 0.5, 1.3];
	const tubes: Solid[] = [];
	const cols = 8;
	const rows = 4;
	const r = 0.032;
	const px = 0.19;
	const pz = 0.19;
	for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
			const x = 0.42 + i * px;
			const z = 0.62 + j * pz + (i % 2 ? pz / 2 : 0);
			if (z > z1 - 0.08) continue;
			tubes.push({ kind: 'cyl', axis: 1, c: [x, 0, z], r, half: (y1 - y0) / 2, part: 'tube' });
		}
	}
	const solids: Solid[] = [
		box([0, y0, z0 - 0.012], [x1, y1, z0], 'floor'),
		box([0, y0, z1], [x1, y1, z1 + 0.012], 'lid'),
		box([0, y0 - T, z0], [x1, y0, z1], 'shell'),
		box([0, y1, z0], [x1, y1 + T, z1], 'wall'),
		box([x1 - T, y0, z0], [x1, y1, z1], 'wall'),
		...wall(0, 0, T, y0, y1, z0, z1, [sq(0, 0.9, 0.22)], 'wall'),
		...tubes
	];
	// Work points sit in the gaps between tubes.
	const gap = (i: number, z: number): Vec3 => [0.42 + (i + 0.5) * px, 0, z];
	return {
		id: 'exchanger',
		name: 'Heat exchanger',
		difficulty: 4,
		blurb: 'A staggered tube bundle: no straight lanes, only weaving ones.',
		solids,
		min: [-0.45, y0 - 0.05, z0 - 0.05],
		max: [x1 + 0.05, y1 + 0.05, z1 + 0.05],
		entry: [0, 0, 0.9],
		links: 50,
		link: 0.08,
		bendLimit: 36,
		voxel: 0.02,
		targets: [
			{ name: 'Row 2 · low', p: gap(1, 0.66) },
			{ name: 'Bundle centre', p: gap(3, 0.95) },
			{ name: 'Row 6 · high', p: gap(5, 1.18) },
			{ name: 'Far row · low', p: gap(6, 0.64) }
		],
		standTop: z0 - 0.012,
		seed: null
	};
}

/** A two-storey maze, carved by a seeded depth-first search. */
export function labyrinth(seed = 7): Level {
	const [nx, ny, nz] = [5, 5, 2];
	const size = 0.42;
	const origin: Vec3 = [0, -(ny * size) / 2, 0.5];
	const r = rng(seed);
	const inside = (c: Cell) =>
		c[0] >= 0 && c[1] >= 0 && c[2] >= 0 && c[0] < nx && c[1] < ny && c[2] < nz;
	const start: Cell = [0, 2, 0];
	const seen = new Set([key(start)]);
	const links: [Cell, Cell][] = [];
	const stack: Cell[] = [start];
	const depth = new Map([[key(start), 0]]);
	while (stack.length) {
		const c = stack[stack.length - 1];
		const options: Cell[] = [];
		for (const [a, d] of [
			[0, 1],
			[0, -1],
			[1, 1],
			[1, -1],
			[2, 1],
			[2, -1]
		] as const) {
			const n: Cell = [...c];
			n[a] += d;
			if (inside(n) && !seen.has(key(n))) options.push(n);
		}
		if (!options.length) {
			stack.pop();
			continue;
		}
		const n = options[Math.floor(r.next() * options.length)];
		seen.add(key(n));
		depth.set(key(n), depth.get(key(c))! + 1);
		links.push([c, n]);
		stack.push(n);
	}
	const open: Cell[] = [];
	for (let i = 0; i < nx; i++)
		for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) open.push([i, j, k]);

	// Work points at increasing depth through the maze, preferring dead ends and
	// alternating floors, so each one is a step harder than the last.
	const degree = new Map<string, number>();
	for (const [a, b] of links) {
		degree.set(key(a), (degree.get(key(a)) ?? 0) + 1);
		degree.set(key(b), (degree.get(key(b)) ?? 0) + 1);
	}
	const all = [...depth.entries()].map(([k, d]) => ({ c: k.split(',').map(Number) as Cell, d }));
	const cap = Math.min(15, Math.max(...all.map((e) => e.d)));
	const used = new Set<string>();
	const targets = [0.3, 0.55, 0.8, 1].map((frac, i) => {
		const want = Math.max(2, Math.round(cap * frac));
		const score = (e: { c: Cell; d: number }) =>
			Math.abs(e.d - want) * 2 +
			(degree.get(key(e.c)) === 1 ? 0 : 1.5) +
			(e.c[2] === i % 2 ? 0 : 1);
		const best = all
			.filter((e) => e.d <= cap && e.d >= 2 && !used.has(key(e.c)))
			.sort((a, b) => score(a) - score(b))[0];
		used.add(key(best.c));
		const floor = best.c[2] === 0 ? 'Lower floor' : 'Upper floor';
		return {
			name: `${floor} · ${best.d} cells in`,
			p: centreOf(best.c, size, origin, -0.08),
			d: best.d
		};
	});
	const deepest = Math.max(...targets.map((t) => t.d));
	return {
		id: 'maze',
		name: 'Labyrinth',
		difficulty: 5,
		blurb: 'A generated maze over two floors. Every route is different.',
		solids: cells(open, links, size, origin, 0.28, start),
		min: [-0.45, origin[1] - 0.05, origin[2] - 0.05],
		max: [nx * size + 0.05, -origin[1] + 0.05, origin[2] + nz * size + 0.05],
		entry: [0, centreOf(start, size, origin)[1], centreOf(start, size, origin)[2]],
		// Long enough for the deepest work point by a comfortable margin.
		links: Math.ceil(((deepest + 1) * size * 1.3 + 0.6) / 0.06),
		link: 0.06,
		bendLimit: 42,
		voxel: 0.025,
		targets: targets.map(({ name, p }) => ({ name, p })),
		standTop: origin[2] - T / 2,
		seed
	};
}

export const LEVELS: ((seed?: number) => Level)[] = [
	wingBox,
	fuelTank,
	ducts,
	exchanger,
	labyrinth
];
