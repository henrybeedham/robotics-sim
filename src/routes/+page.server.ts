import { recentRuns } from '#lib/server/runs.js';

export function load() {
	return { runs: recentRuns() };
}
