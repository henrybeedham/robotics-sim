/** Saved runs for the stack and tandem cells, one JSON summary per row. */
import { all, run } from './db.js';
import { RUN_HISTORY_LIMIT } from './config.js';

export const STACK_KEYS = {
	mode: ['fly', 'stop'],
	pattern: ['column', 'brick', 'interlocked']
} as const;

export interface StackResult {
	mode: 'fly' | 'stop';
	pattern: 'column' | 'brick' | 'interlocked';
	speed: number;
	rate: number;
	seed: number;
	stacked: number;
	missed: number;
	blocked: number;
	time: number;
	throughput: number;
}

export interface TandemResult {
	strategy: 'single' | 'zones' | 'shared';
	layers: number;
	perLayer: number;
	speed: number;
	seed: number;
	time: number;
	rate: number;
	speedup: number;
	waitZone: number;
	waitLayer: number;
}

export type SimId = 'stack' | 'tandem';
export interface Saved<T> {
	id: number;
	createdAt: string;
	summary: T;
}

const num = (v: unknown, min: number, max: number) =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const oneOf = (v: unknown, list: readonly string[]) => typeof v === 'string' && list.includes(v);

const validators: Record<SimId, (b: Record<string, unknown>) => string | null> = {
	stack: (b) => {
		if (!oneOf(b.mode, STACK_KEYS.mode) || !oneOf(b.pattern, STACK_KEYS.pattern))
			return 'Unknown mode or pattern.';
		if (!num(b.speed, 0.05, 1) || !num(b.rate, 1, 30) || !num(b.seed, 0, 2 ** 31))
			return 'Settings are out of range.';
		if (!num(b.stacked, 1, 40) || !num(b.missed, 0, 500) || !num(b.blocked, 0, 1e5))
			return 'Counts are out of range.';
		if (!num(b.time, 1, 1e5) || !num(b.throughput, 0, 5000)) return 'Timing is out of range.';
		return null;
	},
	tandem: (b) => {
		if (!oneOf(b.strategy, ['single', 'zones', 'shared'])) return 'Unknown strategy.';
		if (
			!num(b.layers, 1, 8) ||
			!num(b.perLayer, 1, 20) ||
			!num(b.speed, 0.1, 5) ||
			!num(b.seed, 0, 2 ** 31)
		)
			return 'Settings are out of range.';
		if (!num(b.time, 1, 1e5) || !num(b.rate, 0, 1000) || !num(b.speedup, 0, 4))
			return 'Results are out of range.';
		if (!num(b.waitZone, 0, 1e5) || !num(b.waitLayer, 0, 1e5)) return 'Waits are out of range.';
		return null;
	}
};

export function isSim(s: string): s is SimId {
	return s === 'stack' || s === 'tandem';
}

/** Check a posted summary and keep only the known keys. */
export function cleanResult(
	sim: SimId,
	body: unknown
): { ok: true; value: object } | { ok: false; error: string } {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Expected a JSON object.' };
	const b = body as Record<string, unknown>;
	const problem = validators[sim](b);
	if (problem) return { ok: false, error: problem };
	const keys =
		sim === 'stack'
			? [
					'mode',
					'pattern',
					'speed',
					'rate',
					'seed',
					'stacked',
					'missed',
					'blocked',
					'time',
					'throughput'
				]
			: [
					'strategy',
					'layers',
					'perLayer',
					'speed',
					'seed',
					'time',
					'rate',
					'speedup',
					'waitZone',
					'waitLayer'
				];
	return { ok: true, value: Object.fromEntries(keys.map((k) => [k, b[k]])) };
}

export function saveResult(sim: SimId, summary: object) {
	run('INSERT INTO results (sim, created_at, summary) VALUES (?, ?, ?)', [
		sim,
		new Date().toISOString(),
		JSON.stringify(summary)
	]);
	run(
		'DELETE FROM results WHERE sim = ? AND id <= (SELECT id FROM results WHERE sim = ? ORDER BY id DESC LIMIT 1 OFFSET ?)',
		[sim, sim, RUN_HISTORY_LIMIT]
	);
}

export function recentResults<T>(sim: SimId, limit = 8): Saved<T>[] {
	return all<{ id: number; created_at: string; summary: string }>(
		'SELECT id, created_at, summary FROM results WHERE sim = ? ORDER BY id DESC LIMIT ?',
		[sim, limit]
	).map((r) => ({ id: r.id, createdAt: r.created_at, summary: JSON.parse(r.summary) as T }));
}
