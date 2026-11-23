/**
 * Tandem: two overhead gantries share one set of rails over a long mould. Each
 * picks plies from its own kit table at its end of the cell and lays them on the
 * tool. Bridges cannot pass each other, so before a gantry leaves its kit it
 * reserves the stretch of rail it will sweep. If that overlaps the other
 * gantry's reservation, it waits. Plies are laid layer by layer: no ply of the
 * next layer starts until the current layer is finished.
 * World frame is Z-up, metres.
 */
import { rng } from './random.js';

export const MOULD = { x0: -3.4, x1: 3.4, y0: -1.15, y1: 1.15, base: 0.84 };
export const RAILS = { y: 1.75, z: 2.7, x0: -5.6, x1: 5.6 };
export const KITS = [-4.7, 4.7];
const KIT_TOP = 0.84;
/** Bridges' centres must stay this far apart, plus half of each carried ply. */
const MIN_SEP = 0.8;
const TRAVEL_Z = 1.55;
const AREAL_MASS = 0.6;

export const mouldHeight = (_x: number, y: number) => MOULD.base + 0.06 * (1 - (y / MOULD.y1) ** 2);

export type Strategy = 'single' | 'zones' | 'shared';
export const STRATEGIES: { id: Strategy; name: string }[] = [
	{ id: 'single', name: 'One gantry' },
	{ id: 'zones', name: 'Fixed halves' },
	{ id: 'shared', name: 'Shared queue' }
];

export interface TandemConfig {
	strategy: Strategy;
	layers: number;
	perLayer: number;
	/** Bridge speed along the rails, m/s. */
	speed: number;
	seed: number;
}

export const DEFAULT_TANDEM: TandemConfig = {
	strategy: 'shared',
	layers: 4,
	perLayer: 8,
	speed: 1.2,
	seed: 7
};

export interface TPly {
	id: number;
	layer: number;
	x: number;
	y: number;
	length: number;
	width: number;
	angle: number;
	state: 'waiting' | 'kitted' | 'carried' | 'placed';
	by: number | null;
}

export type Activity = 'move' | 'pick' | 'place' | 'zone' | 'layer' | 'idle';
export interface Span {
	gantry: number;
	kind: Activity;
	start: number;
	end: number;
}

interface Axis {
	from: [number, number, number];
	to: [number, number, number];
	t: number;
	duration: number;
}

interface Gantry {
	pos: [number, number, number];
	/** Reserved stretch of rail, [min, max] in x. */
	reserved: [number, number];
	steps: Step[];
	ply: TPly | null;
	busy: number;
	activity: Activity;
	since: number;
}

type Step =
	| { kind: 'move'; to: [number, number, number]; activity: Activity; onEnd?: () => void }
	| { kind: 'dwell'; duration: number; activity: Activity; onEnd?: () => void }
	| { kind: 'reserve'; span: [number, number] }
	| { kind: 'release' };

const quintic = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
const PEAK = 1.875;

export function makePlies(c: Pick<TandemConfig, 'layers' | 'perLayer' | 'seed'>): TPly[] {
	const r = rng(c.seed);
	const seq = [0, 45, -45, 90];
	const out: TPly[] = [];
	for (let layer = 0; layer < c.layers; layer++) {
		for (let k = 0; k < c.perLayer; k++) {
			const length = r.uniform(0.7, 1.2);
			const width = r.uniform(0.5, 0.95);
			out.push({
				id: out.length,
				layer,
				x: r.uniform(MOULD.x0 + length / 2 + 0.05, MOULD.x1 - length / 2 - 0.05),
				y: r.uniform(MOULD.y0 + width / 2 + 0.05, MOULD.y1 - width / 2 - 0.05),
				length,
				width,
				angle: seq[layer % 4],
				state: 'waiting',
				by: null
			});
		}
	}
	return out;
}

/**
 * The scheduler and motion, with no rendering, so the same code can be run
 * instantly to compare strategies.
 */
export class TandemCore {
	config: TandemConfig;
	plies: TPly[];
	gantries: Gantry[];
	time = 0;
	layer = 0;
	timeline: Span[] = [];
	done = false;
	waitZone = [0, 0];
	waitLayer = [0, 0];
	private motion: (Axis | null)[] = [null, null];
	private dwell = [0, 0];
	onChange?: () => void;

	constructor(config: TandemConfig) {
		this.config = config;
		this.plies = makePlies(config);
		this.gantries = KITS.map((kx, i) => ({
			pos: [kx, 0, TRAVEL_Z] as [number, number, number],
			reserved: (i === 0 ? [RAILS.x0, kx] : [kx, RAILS.x1]) as [number, number],
			steps: [],
			ply: null,
			busy: 0,
			activity: 'idle' as Activity,
			since: 0
		}));
	}

	get active() {
		return this.config.strategy === 'single' ? [0] : [0, 1];
	}

	private home(i: number): [number, number] {
		return i === 0 ? [RAILS.x0, KITS[0]] : [KITS[1], RAILS.x1];
	}

	/** Choose the next ply for gantry `i` from the current layer. */
	private choose(i: number): TPly | null {
		const open = this.plies.filter((p) => p.layer === this.layer && p.state === 'waiting');
		if (!open.length) return null;
		const { strategy } = this.config;
		let pool = open;
		if (strategy === 'zones') pool = open.filter((p) => (i === 0 ? p.x < 0 : p.x >= 0));
		if (!pool.length) return null;
		// Each gantry takes the ply nearest its own kit, which keeps the two apart.
		return pool.reduce((best, p) =>
			Math.abs(p.x - KITS[i]) < Math.abs(best.x - KITS[i]) ? p : best
		);
	}

	private plan(i: number, p: TPly) {
		const g = this.gantries[i];
		p.state = 'kitted';
		p.by = i;
		g.ply = p;
		const kx = KITS[i];
		const halfLen = p.length / 2;
		// Reserve from the far side of the ply to the end of the rail behind this gantry's kit.
		const span: [number, number] =
			i === 0 ? [RAILS.x0, p.x + halfLen + MIN_SEP / 2] : [p.x - halfLen - MIN_SEP / 2, RAILS.x1];
		const surface = mouldHeight(p.x, p.y) + 0.004 * (p.layer + 1);
		g.steps = [
			{ kind: 'move', to: [kx, 0, KIT_TOP + 0.02], activity: 'pick' },
			{
				kind: 'dwell',
				duration: 0.4,
				activity: 'pick',
				onEnd: () => {
					p.state = 'carried';
					this.onChange?.();
				}
			},
			{ kind: 'move', to: [kx, 0, TRAVEL_Z], activity: 'pick' },
			{ kind: 'reserve', span },
			{ kind: 'move', to: [p.x, p.y, TRAVEL_Z], activity: 'move' },
			{ kind: 'move', to: [p.x, p.y, surface + 0.02], activity: 'place' },
			{
				kind: 'dwell',
				duration: 0.5,
				activity: 'place',
				onEnd: () => {
					p.state = 'placed';
					g.ply = null;
					this.onChange?.();
				}
			},
			{ kind: 'move', to: [p.x, p.y, TRAVEL_Z], activity: 'place' },
			{ kind: 'move', to: [kx, 0, TRAVEL_Z], activity: 'move' },
			{ kind: 'release' }
		];
		this.onChange?.();
	}

	private axisTime(from: [number, number, number], to: [number, number, number]) {
		const v = [this.config.speed, 1.0, 0.6];
		return Math.max(0.2, ...from.map((f, k) => (Math.abs(to[k] - f) / v[k]) * PEAK));
	}

	private setActivity(i: number, a: Activity) {
		const g = this.gantries[i];
		if (g.activity === a) return;
		if (this.time > g.since)
			this.timeline.push({ gantry: i, kind: g.activity, start: g.since, end: this.time });
		g.activity = a;
		g.since = this.time;
	}

	step(dt: number) {
		if (this.done) return;
		this.time += dt;
		for (const i of this.active) this.advance(i, dt);

		// Layer barrier.
		const current = this.plies.filter((p) => p.layer === this.layer);
		if (current.every((p) => p.state === 'placed')) {
			if (this.layer < this.config.layers - 1) this.layer++;
			else if (this.active.every((i) => !this.gantries[i].steps.length && !this.motion[i])) {
				this.done = true;
				for (const i of this.active) this.setActivity(i, 'idle');
			}
		}
	}

	private advance(i: number, dt: number) {
		const g = this.gantries[i];
		const m = this.motion[i];
		if (m) {
			m.t += dt;
			const s = quintic(Math.min(1, m.t / m.duration));
			g.pos = m.from.map((f, k) => f + (m.to[k] - f) * s) as [number, number, number];
			g.busy += dt;
			if (m.t >= m.duration) {
				this.motion[i] = null;
				const step = g.steps.shift();
				if (step && step.kind === 'move') step.onEnd?.();
			}
			return;
		}
		if (this.dwell[i] > 0) {
			this.dwell[i] -= dt;
			g.busy += dt;
			if (this.dwell[i] <= 0) {
				const step = g.steps.shift();
				if (step && step.kind === 'dwell') step.onEnd?.();
			}
			return;
		}
		const next = g.steps[0];
		if (!next) {
			const p = this.choose(i);
			if (p) this.plan(i, p);
			else {
				const remaining = this.plies.some((q) => q.state === 'waiting');
				this.setActivity(i, remaining ? 'layer' : 'idle');
				if (remaining) this.waitLayer[i] += dt;
			}
			return;
		}
		if (next.kind === 'reserve') {
			const other = this.gantries[1 - i];
			const blocked =
				this.active.length === 2 &&
				(i === 0 ? next.span[1] > other.reserved[0] : next.span[0] < other.reserved[1]);
			if (blocked) {
				this.setActivity(i, 'zone');
				this.waitZone[i] += dt;
				return;
			}
			g.reserved = next.span;
			g.steps.shift();
			return;
		}
		if (next.kind === 'release') {
			g.reserved = this.home(i);
			g.steps.shift();
			return;
		}
		this.setActivity(i, next.activity);
		if (next.kind === 'move') {
			this.motion[i] = {
				from: [...g.pos],
				to: next.to,
				t: 0,
				duration: this.axisTime(g.pos, next.to)
			};
		} else this.dwell[i] = next.duration;
	}

	/** Run to completion as fast as possible (for comparisons). */
	runToEnd() {
		for (let k = 0; k < 400000 && !this.done; k++) this.step(0.02);
		return this.time;
	}
}

export function plyMass(p: TPly) {
	return p.length * p.width * AREAL_MASS;
}

/** The live, rendered simulation. */
export class Tandem {
	config = $state<TandemConfig>({ ...DEFAULT_TANDEM });
	status = $state<'idle' | 'running' | 'paused' | 'done'>('idle');
	warp = $state(4);
	time = $state(0);
	layer = $state(0);
	/** Ply states, refreshed when the core reports a change. */
	plies = $state.raw<TPly[]>([]);
	timeline = $state.raw<Span[]>([]);
	activity = $state<Activity[]>(['idle', 'idle']);
	/** Makespan of each strategy for this ply book, from instant runs. */
	compare = $state.raw<Record<Strategy, number>>({ single: 0, zones: 0, shared: 0 });
	version = $state(0);
	core!: TandemCore;
	onComplete?: (t: Tandem) => void;
	private clock = 0;
	private loop: boolean;

	constructor(demo = false) {
		this.loop = demo;
		this.reset();
	}

	configure(patch: Partial<TandemConfig>) {
		this.config = { ...this.config, ...patch };
		this.reset();
	}

	reset() {
		this.core = new TandemCore({ ...this.config });
		this.core.onChange = () => {
			this.plies = this.core.plies.map((p) => ({ ...p }));
			this.version++;
		};
		this.plies = this.core.plies.map((p) => ({ ...p }));
		this.timeline = [];
		this.time = 0;
		this.layer = 0;
		this.activity = ['idle', 'idle'];
		this.status = 'idle';
		this.version++;
		if (!this.loop) {
			const c = {} as Record<Strategy, number>;
			for (const s of STRATEGIES)
				c[s.id] = new TandemCore({ ...this.config, strategy: s.id }).runToEnd();
			this.compare = c;
		}
	}

	start() {
		if (this.status === 'done') this.reset();
		this.status = 'running';
	}

	pause() {
		if (this.status === 'running') this.status = 'paused';
	}

	get gantries() {
		return this.core.gantries;
	}

	get results() {
		const placed = this.plies.filter((p) => p.state === 'placed');
		const mass = placed.reduce((m, p) => m + plyMass(p), 0);
		const c = this.core;
		const single = this.compare.single;
		return {
			placed: placed.length,
			rate: this.time > 0 ? (mass * 3600) / this.time : 0,
			utilisation: c.gantries.map((g) => (this.time > 0 ? g.busy / this.time : 0)),
			waitZone: c.waitZone.reduce((a, b) => a + b, 0),
			waitLayer: c.waitLayer.reduce((a, b) => a + b, 0),
			speedup: this.status === 'done' && single > 0 ? single / this.time : null
		};
	}

	tick(realDt: number) {
		if (this.status !== 'running') return;
		let dt = Math.min(realDt, 0.25) * this.warp;
		while (dt > 0 && !this.core.done) {
			const h = Math.min(dt, 0.02);
			this.core.step(h);
			dt -= h;
		}
		this.time = this.core.time;
		this.clock += realDt;
		if (this.clock > 0.15 || this.core.done) {
			this.clock = 0;
			this.layer = this.core.layer;
			this.activity = this.core.gantries.map((g) => g.activity);
			this.timeline = [...this.core.timeline];
		}
		if (this.core.done) {
			if (this.loop) {
				this.reset();
				this.status = 'running';
				return;
			}
			this.status = 'done';
			this.onComplete?.(this);
		}
	}
}
