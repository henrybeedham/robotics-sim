/**
 * The layup simulation: plans each pick-and-place cycle as a list of motion
 * segments, plays them back against a simulated clock and scores every ply.
 *
 * Hot per-frame data (poses, vertex buffers) lives in plain fields that the 3D
 * components read in their render loop. Anything the panels show is $state.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
	type Joints,
	type Kinematics,
	forward,
	inverse,
	HOME,
	JOINT_SPEED,
	RAIL
} from './robot.js';
import {
	type MouldId,
	type Offset2,
	IDENTITY,
	PLY,
	PLY_GRID,
	PLY_MASS,
	applyOffset,
	compose,
	conformProfile,
	cornerDeviation,
	invert,
	kitPose,
	mouldNormal,
	offsetPose,
	placePose,
	rayToMould,
	standOff,
	stationXs
} from './cell.js';
import { rng } from './random.js';

export type Angle = 0 | 45 | -45 | 90;
export const ANGLES: Angle[] = [0, 45, -45, 90];

export interface Config {
	mould: MouldId;
	layers: Angle[];
	stations: number;
	/** Locate each ply with the camera before picking it. */
	vision: boolean;
	/** Robot placement repeatability, one standard deviation, mm. */
	repeatability: number;
	/** Inspection pass band, ± mm at the worst corner. */
	tolerance: number;
	/** Speed override, percent of maximum. */
	override: number;
	seed: number;
}

export const DEFAULT_CONFIG: Config = {
	mould: 'wing',
	layers: [0, 45, -45, -45, 45, 0],
	stations: 3,
	vision: true,
	repeatability: 0.4,
	tolerance: 2,
	override: 80,
	seed: 1998
};

export type PlyStatus = 'queued' | 'kitted' | 'carried' | 'placed' | 'inspected';

export interface PlyRecord {
	index: number;
	layer: number;
	station: number;
	angle: Angle;
	status: PlyStatus;
	/** Worst-corner deviation found by inspection, mm. */
	deviation: number | null;
	pass: boolean | null;
	/** Pick-to-retract time, simulated seconds. */
	cycle: number | null;
	/** Measured in-plane error (u, v in mm, theta in degrees), for the inspection plot. */
	measured: Offset2 | null;
}

interface PlyData {
	kitOffset: Offset2;
	visionNoise: Offset2;
	pickError: Offset2;
	placeError: Offset2;
	measureNoise: number;
	/** Ply pose relative to the gripper once picked. */
	rel: Offset2;
	placed: Float32Array | null;
	kitted: Float32Array | null;
}

type Segment = {
	label: string;
	duration: number;
	blend?: [number, number];
	onStart?: () => void;
	onEnd?: () => void;
} & (
	| { kind: 'joint'; q0: Joints; q1: Joints; r0: number; r1: number }
	| { kind: 'cart'; p0: Matrix4; p1: Matrix4 }
	| { kind: 'dwell' }
);

export type Phase =
	| 'Ready'
	| 'To kit'
	| 'Locate ply'
	| 'Descend'
	| 'Vacuum on'
	| 'Lift'
	| 'Transfer and conform'
	| 'Drape'
	| 'Tack and release'
	| 'Retract'
	| 'Complete';

const quintic = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
/** Peak speed of a quintic move relative to its average speed. */
const PEAK = 1.875;
const HOVER = 0.2;
const SCAN_TIME = 1.1;

const mm = 1000;
const deg = Math.PI / 180;

export class Simulation {
	config = $state<Config>(structuredClone(DEFAULT_CONFIG));
	status = $state<'idle' | 'running' | 'paused' | 'done' | 'error'>('idle');
	error = $state<string | null>(null);
	phase = $state<Phase>('Ready');
	time = $state(0);
	warp = $state(2);
	plies = $state<PlyRecord[]>([]);
	current = $state(-1);
	vacuum = $state(false);
	heat = $state(0);
	/** Inspection scanner: which ply and how far across, 0–1. */
	scan = $state<{ ply: number; progress: number } | null>(null);
	/** Throttled copy of the joint state for the panels (10 Hz). */
	readout = $state({ q: [...HOME] as Joints, rail: 0, tcp: [0, 0, 0] as [number, number, number] });

	// Hot state, read by the renderer every frame.
	q: Joints = [...HOME];
	rail = 0;
	kin: Kinematics = forward(HOME, 0);
	blend = 0;
	conform: (u: number, v: number) => number = () => 0;
	/** Bumped whenever a ply's geometry changes in a way the renderer must rebuild. */
	geometryVersion = $state(0);

	private data: PlyData[] = [];
	private segments: Segment[] = [];
	private segIndex = 0;
	private segTime = 0;
	private cycleStart = 0;
	private lastRelease = 0;
	private readoutClock = 0;
	private carriedPose = new Matrix4();
	onComplete?: (sim: Simulation) => void;

	constructor() {
		this.reset();
	}

	get stationXs() {
		return stationXs(this.config.stations);
	}

	configure(patch: Partial<Config>) {
		this.config = { ...this.config, ...patch };
		this.reset();
	}

	reset() {
		const { layers, stations, seed, repeatability } = this.config;
		const r = rng(seed);
		const sigma = repeatability / mm;
		this.plies = [];
		this.data = [];
		let index = 0;
		layers.forEach((angle, layer) => {
			for (let station = 0; station < stations; station++) {
				this.plies.push({
					index: index++,
					layer,
					station,
					angle,
					status: 'queued',
					deviation: null,
					pass: null,
					cycle: null,
					measured: null
				});
				// Draw in a fixed order so changing a setting keeps the same disturbances.
				const kitOffset = {
					u: r.uniform(-6, 6) / mm,
					v: r.uniform(-6, 6) / mm,
					theta: r.uniform(-1.2, 1.2) * deg
				};
				const visionNoise = {
					u: r.gauss(0.25) / mm,
					v: r.gauss(0.25) / mm,
					theta: r.gauss(0.05) * deg
				};
				const pickError = { u: r.gauss(sigma), v: r.gauss(sigma), theta: r.gauss(sigma / 0.4) };
				const placeError = { u: r.gauss(sigma), v: r.gauss(sigma), theta: r.gauss(sigma / 0.4) };
				const measureNoise = r.gauss(0.04);
				this.data.push({
					kitOffset,
					visionNoise,
					pickError,
					placeError,
					measureNoise,
					rel: IDENTITY,
					placed: null,
					kitted: null
				});
			}
		});
		this.q = [...HOME];
		this.rail = this.stationXs[0] ?? 0;
		this.kin = forward(this.q, this.rail);
		this.blend = 0;
		this.conform = () => 0;
		this.vacuum = false;
		this.heat = 0;
		this.scan = null;
		this.time = 0;
		this.current = -1;
		this.segments = [];
		this.segIndex = 0;
		this.segTime = 0;
		this.phase = 'Ready';
		this.error = null;
		this.status = 'idle';
		this.lastRelease = 0;
		this.updateReadout();
		this.error = this.checkReach();
		if (this.error) this.status = 'error';
		if (this.plies.length) this.present(0);
		this.geometryVersion++;
	}

	start() {
		if (this.status === 'error' || !this.plies.length) return;
		if (this.status === 'done') this.reset();
		if (this.status === 'idle') this.beginPly(0);
		this.status = 'running';
	}

	pause() {
		if (this.status === 'running') this.status = 'paused';
	}

	/** Every target must be reachable before a run starts. */
	private checkReach(): string | null {
		let q: Joints = [...HOME];
		for (const ply of this.plies) {
			const x = this.stationXs[ply.station];
			const targets = [
				kitPose(x),
				standOff(kitPose(x), HOVER),
				placePose(this.config.mould, x),
				standOff(placePose(this.config.mould, x), HOVER)
			];
			for (const t of targets) {
				const next = inverse(t, x, q);
				if (!next) return `Ply ${ply.index + 1} is out of the arm’s reach.`;
				q = next;
			}
		}
		return null;
	}

	/** The feeder lays a ply on the kit table, slightly off its nominal slot. */
	private present(i: number) {
		const ply = this.plies[i];
		if (!ply) return;
		const d = this.data[i];
		const pose = offsetPose(kitPose(this.stationXs[ply.station]), d.kitOffset);
		d.kitted = plyVertices((u, v) => {
			const p = new Vector3(0, u, v).applyMatrix4(pose);
			return [p.x, p.y, p.z + 0.001];
		});
		ply.status = 'kitted';
		this.geometryVersion++;
	}

	private ik(pose: Matrix4, rail: number, prev: Joints) {
		const q = inverse(pose, rail, prev);
		if (!q) throw new Error('Target out of reach');
		return q;
	}

	private jointMove(label: string, q0: Joints, r0: number, q1: Joints, r1: number): Segment {
		const scale = this.config.override / 100;
		let t = (Math.abs(r1 - r0) / (RAIL.speed * scale)) * PEAK;
		q1.forEach((v, i) => {
			t = Math.max(t, (Math.abs(v - q0[i]) / (JOINT_SPEED[i] * scale)) * PEAK);
		});
		return { kind: 'joint', label, q0, q1, r0, r1, duration: Math.max(t, 0.35) };
	}

	private linearMove(label: string, p0: Matrix4, p1: Matrix4): Segment {
		const scale = this.config.override / 100;
		const d = new Vector3()
			.setFromMatrixPosition(p0)
			.distanceTo(new Vector3().setFromMatrixPosition(p1));
		return { kind: 'cart', label, p0, p1, duration: Math.max((d / (0.45 * scale)) * PEAK, 0.3) };
	}

	/** Plan one full cycle for ply `i`, starting from the arm's current state. */
	private beginPly(i: number) {
		const ply = this.plies[i];
		const d = this.data[i];
		const { mould, vision } = this.config;
		const x = this.stationXs[ply.station];
		this.current = i;
		this.cycleStart = this.time;

		// With vision, the camera's estimate of the ply's offset corrects the pick.
		const correction = vision ? compose(d.kitOffset, d.visionNoise) : IDENTITY;
		const nominalPick = kitPose(x);
		const pick = offsetPose(nominalPick, correction);
		const pickAbove = standOff(pick, HOVER);
		const nominalAbove = standOff(nominalPick, HOVER);
		const place = placePose(mould, x);
		const placeAbove = standOff(place, HOVER);
		const conform = conformProfile(mould, place);

		try {
			const q0: Joints = [...this.q];
			const qAboveKit = this.ik(nominalAbove, x, q0);
			const qPickAbove = this.ik(pickAbove, x, qAboveKit);
			const qPlaceAbove = this.ik(placeAbove, x, qPickAbove);

			const segs: Segment[] = [];
			segs.push(this.jointMove('To kit', q0, this.rail, qAboveKit, x));
			if (vision) {
				segs.push({ kind: 'dwell', label: 'Locate ply', duration: 0.45 });
				segs.push(this.linearMove('Descend', nominalAbove, pick));
			} else {
				segs.push(this.linearMove('Descend', nominalAbove, pick));
			}
			segs.push({
				kind: 'dwell',
				label: 'Vacuum on',
				duration: 0.3,
				onStart: () => (this.vacuum = true),
				onEnd: () => {
					// The ply is now held wherever it actually was, relative to where the gripper actually is.
					const actual = compose(correction, d.pickError);
					d.rel = compose(invert(actual), d.kitOffset);
					ply.status = 'carried';
					this.geometryVersion++;
				}
			});
			segs.push({
				...this.linearMove('Lift', pick, pickAbove),
				onEnd: () => this.present(i + 1)
			});
			segs.push({
				...this.jointMove('Transfer and conform', qPickAbove, x, qPlaceAbove, x),
				blend: [0, 1],
				onStart: () => (this.conform = conform)
			});
			const placeActual = offsetPose(place, d.placeError);
			segs.push({ ...this.linearMove('Drape', placeAbove, placeActual), blend: [1, 1] });
			segs.push({
				kind: 'dwell',
				label: 'Tack and release',
				duration: 0.5,
				blend: [1, 1],
				onEnd: () => this.release(i, place)
			});
			segs.push({
				...this.linearMove('Retract', placeActual, placeAbove),
				blend: [1, 0],
				onEnd: () => {
					ply.cycle = this.time - this.cycleStart;
				}
			});
			this.segments = segs;
			this.segIndex = 0;
			this.segTime = 0;
			this.segments[0].onStart?.();
		} catch {
			this.error = `Ply ${i + 1} could not be planned.`;
			this.status = 'error';
		}
	}

	private release(i: number, place: Matrix4) {
		const ply = this.plies[i];
		const d = this.data[i];
		const { mould } = this.config;
		const error = compose(d.placeError, d.rel);
		const origin = new Vector3().setFromMatrixPosition(place);
		const ax = new Vector3();
		const ay = new Vector3();
		const az = new Vector3();
		place.extractBasis(ax, ay, az);
		const lift = (ply.layer + 1) * PLY.visualThickness;
		const p = new Vector3();
		d.placed = plyVertices((u, v) => {
			const [pu, pv] = applyOffset(error, u, v);
			p.copy(origin).addScaledVector(ay, pu).addScaledVector(az, pv);
			p.addScaledVector(ax, rayToMould(mould, p, ax));
			const n = mouldNormal(mould, p.x, p.y);
			p.addScaledVector(n, lift);
			return [p.x, p.y, p.z];
		});
		this.vacuum = false;
		this.heat = 0;
		ply.status = 'placed';
		this.lastRelease = this.time;
		this.geometryVersion++;

		// Inspection happens while the arm leaves.
		const measuredDev = Math.max(0, cornerDeviation(error) * mm + d.measureNoise);
		this.scan = { ply: i, progress: 0 };
		this.pendingInspection = () => {
			ply.deviation = measuredDev;
			ply.pass = measuredDev <= this.config.tolerance;
			ply.measured = { u: error.u * mm, v: error.v * mm, theta: error.theta / deg };
			ply.status = 'inspected';
		};
	}

	private pendingInspection: (() => void) | null = null;

	/** Advance by `realDt` seconds of wall time. */
	tick(realDt: number) {
		if (this.status !== 'running') return;
		let dt = Math.min(realDt, 0.25) * this.warp;

		if (this.scan) {
			this.scan.progress = Math.min(1, this.scan.progress + dt / SCAN_TIME);
			if (this.scan.progress >= 1) {
				this.pendingInspection?.();
				this.pendingInspection = null;
				this.scan = null;
				if (this.current === -1) this.finish();
			}
		}

		while (dt > 0 && this.current >= 0) {
			const seg = this.segments[this.segIndex];
			const remaining = seg.duration - this.segTime;
			const step = Math.min(dt, remaining);
			this.segTime += step;
			this.time += step;
			dt -= step;
			this.apply(seg, this.segTime / seg.duration);
			if (this.segTime >= seg.duration - 1e-9) {
				seg.onEnd?.();
				this.segIndex++;
				this.segTime = 0;
				if (this.segIndex >= this.segments.length) {
					const next = this.current + 1;
					if (next < this.plies.length) this.beginPly(next);
					else {
						this.current = -1;
						this.phase = 'Complete';
						if (!this.scan) this.finish();
					}
					if (this.status !== 'running') break;
				} else {
					this.segments[this.segIndex].onStart?.();
				}
			}
		}
		if (this.current === -1 && this.scan) this.time += dt;

		this.kin = forward(this.q, this.rail);
		this.readoutClock += realDt;
		if (this.readoutClock > 0.1) {
			this.readoutClock = 0;
			this.updateReadout();
		}
	}

	private apply(seg: Segment, t: number) {
		const s = quintic(Math.min(1, Math.max(0, t)));
		if (this.phase !== seg.label) this.phase = seg.label as Phase;
		if (seg.kind === 'joint') {
			this.q = seg.q0.map((v, i) => v + (seg.q1[i] - v) * s) as Joints;
			this.rail = seg.r0 + (seg.r1 - seg.r0) * s;
		} else if (seg.kind === 'cart') {
			const pa = new Vector3();
			const pb = new Vector3();
			const qa = new Quaternion();
			const qb = new Quaternion();
			const sc = new Vector3();
			seg.p0.decompose(pa, qa, sc);
			seg.p1.decompose(pb, qb, sc);
			const pose = new Matrix4().compose(pa.lerp(pb, s), qa.slerp(qb, s), new Vector3(1, 1, 1));
			const q = inverse(pose, this.rail, this.q);
			if (q) this.q = q;
		}
		if (seg.blend) this.blend = seg.blend[0] + (seg.blend[1] - seg.blend[0]) * s;
		if (seg.label === 'Tack and release') this.heat = Math.sin(Math.PI * t);
	}

	private finish() {
		this.status = 'done';
		this.phase = 'Complete';
		this.updateReadout();
		this.onComplete?.(this);
	}

	private updateReadout() {
		const p = new Vector3().setFromMatrixPosition(this.kin.tcp);
		this.readout = { q: [...this.q], rail: this.rail, tcp: [p.x, p.y, p.z] };
	}

	/** World-space vertex buffer for ply `i` in its current state, or null if hidden. */
	plyVertices(i: number, out: Float32Array): boolean {
		const ply = this.plies[i];
		const d = this.data[i];
		if (!ply || !d) return false;
		if (ply.status === 'queued') return false;
		if (ply.status === 'kitted' && d.kitted) {
			out.set(d.kitted);
			return true;
		}
		if ((ply.status === 'placed' || ply.status === 'inspected') && d.placed) {
			out.set(d.placed);
			return true;
		}
		if (ply.status === 'carried') {
			const tcp = this.carriedPose.copy(this.kin.tcp);
			const p = new Vector3();
			let k = 0;
			eachGrid((u, v) => {
				const [pu, pv] = applyOffset(d.rel, u, v);
				const a = this.blend * this.conform(pu, pv) + 0.0015;
				p.set(a, pu, pv).applyMatrix4(tcp);
				out[k++] = p.x;
				out[k++] = p.y;
				out[k++] = p.z;
			});
			return true;
		}
		return false;
	}

	get results() {
		const done = this.plies.filter((p) => p.status === 'inspected');
		const cycles = this.plies.map((p) => p.cycle).filter((c): c is number => c !== null);
		const devs = done.map((p) => p.deviation ?? 0);
		const placedCount = this.plies.filter(
			(p) => p.status === 'placed' || p.status === 'inspected'
		).length;
		return {
			placed: placedCount,
			inspected: done.length,
			passed: done.filter((p) => p.pass).length,
			meanCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
			// Whole-run average from the start button to the last release, so travel and waits count.
			rate:
				placedCount && this.lastRelease > 0
					? (placedCount * PLY_MASS * 3600) / this.lastRelease
					: null,
			meanDeviation: devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : null,
			maxDeviation: devs.length ? Math.max(...devs) : null,
			mass: placedCount * PLY_MASS
		};
	}
}

function eachGrid(fn: (u: number, v: number) => void) {
	const { nu, nv } = PLY_GRID;
	for (let j = 0; j < nv; j++) {
		for (let i = 0; i < nu; i++) {
			fn(
				-PLY.length / 2 + (PLY.length * i) / (nu - 1),
				-PLY.width / 2 + (PLY.width * j) / (nv - 1)
			);
		}
	}
}

function plyVertices(fn: (u: number, v: number) => [number, number, number]) {
	const out = new Float32Array(PLY_GRID.nu * PLY_GRID.nv * 3);
	let k = 0;
	eachGrid((u, v) => {
		const [x, y, z] = fn(u, v);
		out[k++] = x;
		out[k++] = y;
		out[k++] = z;
	});
	return out;
}
