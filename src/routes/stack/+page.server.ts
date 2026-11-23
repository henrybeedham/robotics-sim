import { recentResults, type StackResult } from '#lib/server/results.js';

export function load() {
	return { runs: recentResults<StackResult>('stack') };
}
