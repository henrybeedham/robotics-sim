import { recentResults, type TandemResult } from '#lib/server/results.js';

export function load() {
	return { runs: recentResults<TandemResult>('tandem') };
}
