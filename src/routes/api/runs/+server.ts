import { json, error } from '@sveltejs/kit';
import { recentRuns, saveRun, validateRun, type NewRun } from '#lib/server/runs.js';
import { limiter } from '#lib/server/rate-limit.js';
import type { RequestHandler } from './$types';

const allow = limiter(20, 60_000);

export function GET() {
	return json(recentRuns());
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allow(getClientAddress()))
		error(429, 'Too many runs saved from this address. Try again in a minute.');
	const body: unknown = await request.json().catch(() => null);
	const problem = validateRun(body);
	if (problem) error(400, problem);
	const id = saveRun(body as NewRun);
	return json({ id, runs: recentRuns() }, { status: 201 });
};
