import { recentRuns } from '#lib/server/runs.js';
import { recentResults, type StackResult, type TandemResult } from '#lib/server/results.js';

export function load() {
	return {
		drape: recentRuns(1)[0] ?? null,
		stack: recentResults<StackResult>('stack', 1)[0]?.summary ?? null,
		tandem: recentResults<TandemResult>('tandem', 1)[0]?.summary ?? null
	};
}
