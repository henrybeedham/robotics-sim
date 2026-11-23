/** Saved layup runs: the public results table. */
import { all, run } from './db';
import { RUN_HISTORY_LIMIT } from './config';
import { MOULDS, type MouldId } from '#lib/sim/cell.js';
import { ANGLES } from '#lib/sim/engine.svelte.js';

export interface RunSummary {
	id: number;
	createdAt: string;
	mould: MouldId;
	layers: number[];
	stations: number;
	vision: boolean;
	repeatability: number;
	tolerance: number;
	override: number;
	seed: number;
	plies: number;
	passed: number;
	meanCycle: number;
	rate: number;
	meanDeviation: number;
	maxDeviation: number;
}

export type NewRun = Omit<RunSummary, 'id' | 'createdAt'>;

interface Row {
	id: number;
	created_at: string;
	mould: MouldId;
	layers: string;
	stations: number;
	vision: number;
	repeatability: number;
	tolerance: number;
	override: number;
	seed: number;
	plies: number;
	passed: number;
	mean_cycle: number;
	rate: number;
	mean_deviation: number;
	max_deviation: number;
}

const toRun = (r: Row): RunSummary => ({
	id: r.id,
	createdAt: r.created_at,
	mould: r.mould,
	layers: JSON.parse(r.layers) as number[],
	stations: r.stations,
	vision: r.vision === 1,
	repeatability: r.repeatability,
	tolerance: r.tolerance,
	override: r.override,
	seed: r.seed,
	plies: r.plies,
	passed: r.passed,
	meanCycle: r.mean_cycle,
	rate: r.rate,
	meanDeviation: r.mean_deviation,
	maxDeviation: r.max_deviation
});

export function recentRuns(limit = 12) {
	return all<Row>('SELECT * FROM runs ORDER BY id DESC LIMIT ?', [limit]).map(toRun);
}

const num = (v: unknown, min: number, max: number) =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Check a run posted by a browser. Returns an error message, or null if it is acceptable. */
export function validateRun(body: unknown): string | null {
	if (!body || typeof body !== 'object') return 'Expected a JSON object.';
	const b = body as Record<string, unknown>;
	if (!MOULDS.some((m) => m.id === b.mould)) return 'Unknown mould.';
	if (
		!Array.isArray(b.layers) ||
		b.layers.length < 1 ||
		b.layers.length > 16 ||
		!b.layers.every((a) => (ANGLES as number[]).includes(a as number))
	)
		return 'Layers must be 1 to 16 angles of 0, 45, −45 or 90.';
	if (!num(b.stations, 1, 3) || !Number.isInteger(b.stations)) return 'Stations must be 1 to 3.';
	if (typeof b.vision !== 'boolean') return 'Vision must be true or false.';
	if (!num(b.repeatability, 0, 10) || !num(b.tolerance, 0.1, 20))
		return 'Accuracy settings are out of range.';
	if (!num(b.override, 10, 100) || !num(b.seed, 0, 2 ** 31))
		return 'Speed or seed is out of range.';
	const plies = (b.layers as number[]).length * (b.stations as number);
	if (b.plies !== plies) return 'Ply count does not match the ply book.';
	if (!num(b.passed, 0, plies)) return 'Pass count is out of range.';
	if (!num(b.meanCycle, 1, 120) || !num(b.rate, 0, 1000)) return 'Timing figures are out of range.';
	if (!num(b.meanDeviation, 0, 100) || !num(b.maxDeviation, 0, 100))
		return 'Deviation figures are out of range.';
	return null;
}

export function saveRun(r: NewRun) {
	const result = run(
		`INSERT INTO runs (created_at, mould, layers, stations, vision, repeatability, tolerance, override, seed,
			plies, passed, mean_cycle, rate, mean_deviation, max_deviation)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			new Date().toISOString(),
			r.mould,
			JSON.stringify(r.layers),
			r.stations,
			r.vision ? 1 : 0,
			r.repeatability,
			r.tolerance,
			Math.round(r.override),
			Math.round(r.seed),
			r.plies,
			r.passed,
			r.meanCycle,
			r.rate,
			r.meanDeviation,
			r.maxDeviation
		]
	);
	run('DELETE FROM runs WHERE id <= (SELECT id FROM runs ORDER BY id DESC LIMIT 1 OFFSET ?)', [
		RUN_HISTORY_LIMIT
	]);
	return Number(result.lastInsertRowid);
}
