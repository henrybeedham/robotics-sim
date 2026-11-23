/**
 * Stack: hot steel billets arrive on a chain conveyor at irregular spacing and a
 * six-axis arm stacks them on a pallet. Two strategies can be compared:
 *  - stop and pick: the conveyor halts each billet under the robot;
 *  - pick on the fly: the conveyor never stops and the robot plans an intercept,
 *    then tracks the moving billet while it descends, grips and lifts.
 * World frame is Z-up, metres. The arm is the one in `robot.ts`, without its rail.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { forward, inverse, toolPose, JOINT_SPEED, type Joints } from './robot.js';
import { rng } from './random.js';

export const CONVEYOR = { y: -1.08, top: 0.72, x0: -3.4, x1: 1.7, pickMin: -0.85, pickMax: 0.85 };
export const PALLET = { x: 0, y: 1.12, top: 0.14, size: 1.0 };
export const BILLET = { length: 0.9, section: 0.13, mass: 119 };
const GAP = 0.24;
const HOVER = 0.28;
const LAYERS = 4;

export type Pattern = 'column' | 'brick' | 'interlocked';
export type Mode = 'stop' | 'fly';

export const PATTERNS: { id: Pattern; name: string; interlock: number }[] = [
	{ id: 'column', name: 'Column', interlock: 0 },
	{ id: 'brick', name: 'Brick', interlock: 0.5 },
	{ id: 'interlocked', name: 'Cross', interlock: 1 }
];

export interface StackConfig {
	mode: Mode;
	pattern: Pattern;
	/** Conveyor speed, m/s. */
	speed: number;
	/** Mean arrivals per minute. */
	rate: number;
	seed: number;
}

export const DEFAULT_STACK: StackConfig = {
	mode: 'fly',
	pattern: 'interlocked',
	speed: 0.25,
	rate: 8,
	seed: 42
};

/** Pallet slots in placing order: centre position, yaw (0 = long axis along Y). */
export function slots(pattern: Pattern) {
	const out: { x: number; y: number; z: number; yaw: number; layer: number }[] = [];
	const pitch = 0.15;
	for (let layer = 0; layer < LAYERS; layer++) {
		const z = PALLET.top + BILLET.section / 2 + layer * BILLET.section;
		const odd = layer % 2 === 1;
		if (pattern === 'interlocked' && odd) {
			for (let i = 0; i < 6; i++)
				out.push({
					x: PALLET.x,
					y: PALLET.y - 2.5 * pitch + i * pitch,
					z,
					yaw: Math.PI / 2,
					layer
				});
		} else if (pattern === 'brick' && odd) {
			for (let i = 0; i < 5; i++)
				out.push({ x: PALLET.x - 2 * pitch + i * pitch, y: PALLET.y, z, yaw: 0, layer });
		} else {
			for (let i = 0; i < 6; i++)
				out.push({ x: PALLET.x - 2.5 * pitch + i * pitch, y: PALLET.y, z, yaw: 0, layer });
		}
	}
	return out;
}

export type BilletState = 'conveyor' | 'held' | 'stacked' | 'missed';

export interface Billet {
	id: number;
	x: number;
	/** Lateral offset and yaw as measured by the camera arch. */
	dy: number;
	yaw: number;
	born: number;
	state: BilletState;
	/** Final pose once stacked or dropped (world). */
	rest: Matrix4 | null;
	claimed: boolean;
}

type Phase =
	| 'Waiting'
	| 'To intercept'
	| 'Track and descend'
	| 'Grip'
	| 'Lift'
	| 'To pallet'
	| 'Lower'
	| 'Release'
	| 'Rise'
	| 'Return';

interface Seg {
	phase: Phase;
	duration: number;
	kind: 'joint' | 'cart' | 'track' | 'dwell';
	q0?: Joints;
	q1?: Joints;
	p0?: Matrix4;
	p1?: Matrix4;
	/** For tracking moves: height above the billet at start and end. */
	h0?: number;
	h1?: number;
	billet?: Billet;
	onEnd?: () => void;
}

const quintic = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
const PEAK = 1.875;
const DOWN = new Vector3(0, 0, -1);

/** Tool pose to grip a billet lying at (x, y, z) with the given yaw. */
function gripPose(x: number, y: number, z: number, yaw: number, above = 0) {
	const along = new Vector3(-Math.sin(yaw), Math.cos(yaw), 0);
	return toolPose(new Vector3(x, y, z + BILLET.section / 2 + above), DOWN, along);
}

export const STANDBY = gripPose(0, CONVEYOR.y, CONVEYOR.top + BILLET.section / 2, 0, HOVER);
export const STANDBY_Q: Joints = inverse(STANDBY, 0)!;

export class Stack {
	config = $state<StackConfig>({ ...DEFAULT_STACK });
	status = $state<'idle' | 'running' | 'paused' | 'done'>('idle');
	time = $state(0);
	warp = $state(2);
	phase = $state<Phase>('Waiting');
	billets = $state<Billet[]>([]);
	stacked = $state(0);
	missed = $state(0);
	blocked = $state(0);
	busy = $state(0);
	conveyorRunning = $state(true);

	q: Joints = [...STANDBY_Q];
	rail = 0;
	held: Billet | null = null;
	/** Bumped when billets change state so the renderer can rebuild. */
	version = $state(0);
	onComplete?: (s: Stack) => void;

	private r = rng(1);
	private nextArrival = 0;
	private waiting = 0;
	private segs: Seg[] = [];
	private si = 0;
	private st = 0;
	private nextId = 0;
	private slotList = slots('interlocked');
	private demoLoop = false;

	constructor(demo = false) {
		this.demoLoop = demo;
		this.reset();
	}

	get capacity() {
		return this.slotList.length;
	}

	configure(patch: Partial<StackConfig>) {
		this.config = { ...this.config, ...patch };
		this.reset();
	}

	reset() {
		this.r = rng(this.config.seed);
		this.slotList = slots(this.config.pattern);
		this.billets = [];
		this.time = 0;
		this.stacked = 0;
		this.missed = 0;
		this.blocked = 0;
		this.busy = 0;
		this.waiting = 0;
		this.nextId = 0;
		this.nextArrival = 1;
		this.q = [...STANDBY_Q];
		this.held = null;
		this.segs = [];
		this.si = 0;
		this.st = 0;
		this.phase = 'Waiting';
		this.conveyorRunning = true;
		this.status = 'idle';
		this.version++;
	}

	start() {
		if (this.status === 'done') this.reset();
		this.status = 'running';
	}

	pause() {
		if (this.status === 'running') this.status = 'paused';
	}

	get results() {
		const hours = this.time / 3600;
		return {
			throughput: this.time > 0 ? this.stacked / hours : 0,
			tonnesPerHour: this.time > 0 ? (this.stacked * BILLET.mass) / 1000 / hours : 0,
			utilisation: this.time > 0 ? this.busy / this.time : 0,
			interlock: PATTERNS.find((p) => p.id === this.config.pattern)!.interlock
		};
	}

	/** Position of a billet on the conveyor as a tool pose target. */
	private billetPose(b: Billet, above: number) {
		return gripPose(b.x, CONVEYOR.y + b.dy, CONVEYOR.top, b.yaw, above);
	}

	private jointTime(q0: Joints, q1: Joints, loaded: boolean) {
		// A palletising arm is quicker than the layup arm, but slows down with a 119 kg billet.
		const f = loaded ? 1.2 : 1.7;
		let t = 0;
		q1.forEach((v, i) => (t = Math.max(t, (Math.abs(v - q0[i]) / (JOINT_SPEED[i] * f)) * PEAK)));
		return Math.max(t, 0.35);
	}

	private onConveyor() {
		return this.billets.filter((b) => b.state === 'conveyor').sort((a, b) => b.x - a.x);
	}

	/** Plan the next pick from the arm's current joints, or return false if nothing is catchable. */
	private planPick(): boolean {
		const { speed } = this.config;
		const candidates = this.onConveyor().filter((b) => !b.claimed);
		const track = 0.5 + 0.3 + 0.45;
		for (const b of candidates) {
			// Intercept: where will the billet be once the arm gets above it?
			let xi = Math.max(CONVEYOR.pickMin, b.x);
			for (let k = 0; k < 4; k++) {
				const q = inverse(gripPose(xi, CONVEYOR.y + b.dy, CONVEYOR.top, b.yaw, HOVER), 0, this.q);
				if (!q) break;
				xi = Math.max(CONVEYOR.pickMin, b.x + speed * this.jointTime(this.q, q, false));
			}
			if (xi + speed * track > CONVEYOR.pickMax) continue; // it would escape mid-pick
			// Too early: wait for it to come into the window rather than chasing upstream.
			if (b.x + speed * 0.5 < CONVEYOR.pickMin) return false;
			const hover = gripPose(xi, CONVEYOR.y + b.dy, CONVEYOR.top, b.yaw, HOVER);
			const qh = inverse(hover, 0, this.q);
			if (!qh) continue;
			b.claimed = true;
			// Arrive above the billet just as it reaches the intercept point.
			const travel = this.jointTime(this.q, qh, false);
			const wait = Math.max(0, (xi - b.x) / speed - travel);
			this.segs.push({
				phase: 'To intercept',
				kind: 'joint',
				q0: [...this.q],
				q1: qh,
				duration: travel + wait
			});
			this.pickSegments(b, this.segs);
			return true;
		}
		return false;
	}

	private pickSegments(b: Billet, segs: Seg[]) {
		segs.push({
			phase: 'Track and descend',
			kind: 'track',
			billet: b,
			h0: HOVER,
			h1: 0,
			duration: 0.5
		});
		segs.push({
			phase: 'Grip',
			kind: 'track',
			billet: b,
			h0: 0,
			h1: 0,
			duration: 0.3,
			onEnd: () => {
				b.state = 'held';
				this.held = b;
				this.version++;
			}
		});
		segs.push({
			phase: 'Lift',
			kind: 'track',
			billet: b,
			h0: 0,
			h1: HOVER,
			duration: 0.45,
			onEnd: () => {
				const slot = this.slotList[this.stacked];
				const place = gripPose(slot.x, slot.y, slot.z - BILLET.section / 2, slot.yaw);
				const above = gripPose(slot.x, slot.y, slot.z - BILLET.section / 2, slot.yaw, 0.3);
				const q0 = [...this.q] as Joints;
				const qa = inverse(above, 0, q0)!;
				this.segs.push(
					{ phase: 'To pallet', kind: 'joint', q0, q1: qa, duration: this.jointTime(q0, qa, true) },
					{ phase: 'Lower', kind: 'cart', p0: above, p1: place, duration: 0.55 },
					{
						phase: 'Release',
						kind: 'dwell',
						duration: 0.25,
						onEnd: () => {
							b.state = 'stacked';
							b.rest = place.clone();
							this.held = null;
							this.stacked++;
							this.version++;
						}
					},
					{ phase: 'Rise', kind: 'cart', p0: place, p1: above, duration: 0.45 }
				);
			}
		});
	}

	private spawn() {
		const b: Billet = {
			id: this.nextId++,
			x: CONVEYOR.x0,
			dy: this.r.uniform(-0.035, 0.035),
			yaw: (this.r.uniform(-4, 4) * Math.PI) / 180,
			born: this.time,
			state: 'conveyor',
			rest: null,
			claimed: false
		};
		this.billets.push(b);
		this.version++;
	}

	/** Irregular arrivals: between 0.5× and 1.5× the mean interval. */
	private interval() {
		return (60 / this.config.rate) * this.r.uniform(0.5, 1.5);
	}

	tick(realDt: number) {
		if (this.status !== 'running') return;
		let dt = Math.min(realDt, 0.25) * this.warp;
		while (dt > 0) {
			const h = Math.min(dt, 0.02);
			this.step(h);
			dt -= h;
			if (this.status !== 'running') break;
		}
	}

	private step(dt: number) {
		const { mode, speed } = this.config;
		this.time += dt;

		// Arrivals queue upstream (the furnace has to hold them) when the conveyor's entry is full.
		if (this.time >= this.nextArrival) {
			this.waiting = Math.min(this.waiting + 1, 20);
			this.nextArrival += this.interval();
		}
		if (this.waiting > 0) {
			const last = this.onConveyor().at(-1);
			if (!last || last.x > CONVEYOR.x0 + GAP + BILLET.section) {
				this.waiting--;
				this.spawn();
			} else this.blocked += dt;
		}

		// Conveyor: in stop mode it halts while the lead billet sits at the pick point.
		const lead = this.onConveyor()[0];
		this.conveyorRunning = !(mode === 'stop' && lead && lead.x >= 0);
		if (this.conveyorRunning) {
			const ordered = this.onConveyor();
			for (const b of ordered) b.x += speed * dt;
			if (mode === 'stop' && ordered[0] && ordered[0].x > 0) ordered[0].x = 0;
		}
		for (const b of this.onConveyor()) {
			if (b.x > CONVEYOR.x1) {
				b.state = 'missed';
				b.rest = new Matrix4().makeTranslation(
					CONVEYOR.x1 + 0.35,
					CONVEYOR.y + b.dy,
					0.25 + (this.missed % 4) * 0.13
				);
				this.missed++;
				this.version++;
			}
		}

		// Robot: when the current plan is finished, decide what to do next.
		if (this.si >= this.segs.length) {
			this.segs = [];
			this.si = 0;
			this.st = 0;
			if (this.stacked >= this.capacity) return this.finish();
			const l = this.onConveyor()[0];
			if (mode === 'stop' && l && l.x >= 0 && !l.claimed) {
				l.claimed = true;
				const qh = inverse(this.billetPose(l, HOVER), 0, this.q)!;
				this.segs.push({
					phase: 'To intercept',
					kind: 'joint',
					q0: [...this.q],
					q1: qh,
					duration: this.jointTime(this.q, qh, false)
				});
				this.pickSegments(l, this.segs);
			} else if (mode === 'stop' || !this.planPick()) {
				// Nothing to pick yet: go and wait above the pick point.
				if (STANDBY_Q.some((v, i) => Math.abs(v - this.q[i]) > 1e-3))
					this.segs.push({
						phase: 'Return',
						kind: 'joint',
						q0: [...this.q],
						q1: [...STANDBY_Q],
						duration: this.jointTime(this.q, STANDBY_Q, false)
					});
				else this.segs.push({ phase: 'Waiting', kind: 'dwell', duration: 0.05 });
			}
		}
		const seg = this.segs[this.si];
		if (!seg) return;
		if (seg.phase !== 'Waiting') this.busy += dt;
		this.phase = seg.phase;
		this.st += dt;
		const s = quintic(Math.min(1, this.st / seg.duration));
		if (seg.kind === 'joint') {
			this.q = seg.q0!.map((v, i) => v + (seg.q1![i] - v) * s) as Joints;
		} else if (seg.kind === 'cart') {
			this.follow(interpolate(seg.p0!, seg.p1!, s));
		} else if (seg.kind === 'track') {
			const b = seg.billet!;
			this.follow(this.billetPose(b, seg.h0! + (seg.h1! - seg.h0!) * s));
		}
		if (this.st >= seg.duration) {
			seg.onEnd?.();
			this.si++;
			this.st = 0;
		}
	}

	private inFlight() {
		return this.billets.filter((b) => b.state === 'conveyor' || b.state === 'held').length;
	}

	private follow(pose: Matrix4) {
		const q = inverse(pose, 0, this.q);
		if (q) this.q = q;
	}

	private finish() {
		this.status = 'done';
		this.phase = 'Waiting';
		if (this.demoLoop) {
			this.reset();
			this.status = 'running';
			return;
		}
		this.onComplete?.(this);
	}

	/** World pose of a billet for drawing. */
	poseOf(b: Billet, out = new Matrix4()) {
		if (b.state === 'held') return out.copy(forward(this.q, 0).tcp).multiply(HELD_OFFSET);
		if (b.rest) return out.copy(b.rest).multiply(b.state === 'stacked' ? HELD_OFFSET : IDENT);
		return out
			.makeRotationZ(b.yaw)
			.setPosition(b.x, CONVEYOR.y + b.dy, CONVEYOR.top + BILLET.section / 2);
	}
}

/** From the TCP frame (x down, y along the billet) to the billet's own frame (x along, z up). */
const HELD_OFFSET = new Matrix4()
	.makeBasis(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(-1, 0, 0))
	.setPosition(BILLET.section / 2, 0, 0);
const IDENT = new Matrix4();

function interpolate(a: Matrix4, b: Matrix4, s: number) {
	const pa = new Vector3();
	const pb = new Vector3();
	const qa = new Quaternion();
	const qb = new Quaternion();
	const sc = new Vector3();
	a.decompose(pa, qa, sc);
	b.decompose(pb, qb, sc);
	return new Matrix4().compose(pa.lerp(pb, s), qa.slerp(qb, s), new Vector3(1, 1, 1));
}
